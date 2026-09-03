import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../lib/AuthContext.jsx";
import { capturePhoto } from "../../platform/camera.js";
import { getCurrentLocation } from "../../lib/geolocation.js";
import { recognizeDigits } from "../../lib/ocr.js";
import {
  resolveMeterByQrCode,
  findTodaysReadingForMeter,
  submitReading,
  refreshMetersCache,
  getAllCachedMeters,
} from "../../lib/meterReadingsQuery.js";
import { colors, fonts, text, space } from "../../lib/theme.js";
import { Button, Card, Input, PageHeader } from "../../ui/index.js";

const SCANNER_ELEMENT_ID = "meter-qr-scanner";

// html5-qrcode's stop() throws *synchronously* (not a rejected promise)
// when called on a scanner that isn't currently running/paused -- exactly
// the state a scanner is left in when start() never succeeds (camera
// blocked, denied, or timed out). A bare `.catch()` only guards against a
// rejected promise, so that throw was propagating straight up and
// crashing the whole component with no way back to the manual code entry
// -- reproduced with the browser's own camera access blocked.
function safeStopScanner(scanner) {
  if (!scanner) return;
  try {
    const result = scanner.stop();
    if (result?.catch) result.catch(() => {});
  } catch {
    // Wasn't running/paused -- nothing to stop.
  }
}

export default function ScanMeter() {
  const { profile, org, activeSite } = useAuth();
  const [step, setStep] = useState("scan"); // scan | working | confirm
  const [cameraState, setCameraState] = useState("idle"); // idle | starting | active | error
  const [scanError, setScanError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [workingMessage, setWorkingMessage] = useState("");
  const [meter, setMeter] = useState(null);
  const [reReadNotice, setReReadNotice] = useState(null);
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const [readingValue, setReadingValue] = useState("");
  const [ocr, setOcr] = useState(null); // { text, confidence }
  const [location, setLocation] = useState(null);
  const [overrideWarning, setOverrideWarning] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lastSavedNotice, setLastSavedNotice] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!activeSite) return;
    refreshMetersCache(activeSite.id);
    window.addEventListener("online", () => refreshMetersCache(activeSite.id));
  }, [activeSite]);

  // QR is the preferred way to find a pitch's meter, but a label can be
  // missing or damaged -- search against the offline meter cache (so it
  // works with no signal too) is the fallback, rather than requiring staff
  // to know/type the exact code string.
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    getAllCachedMeters().then((meters) => {
      if (cancelled) return;
      const matches = meters
        .filter((m) => {
          const pitch = (m.pitches?.pitch_number_or_name || "").toLowerCase();
          const customer = (m.customer_name || "").toLowerCase();
          return pitch.includes(q) || customer.includes(q);
        })
        .slice(0, 8);
      setSearchResults(matches);
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  // Camera only starts on explicit request (the button below), never on
  // page load — auto-starting used to mean the whole scan screen's fate
  // rode on whatever the browser/OS does with a getUserMedia call, which
  // ranges from a normal permission prompt down to hanging indefinitely
  // with no prompt at all when the OS blocks camera access outright. Manual
  // code entry works unconditionally with zero camera involvement either
  // way. The 8s timeout race below exists for that hang case specifically —
  // a plain .catch() only handles a *rejected* start(), not one that never
  // settles.
  //
  // Once started, the camera stays running for the rest of the session
  // (paused/resumed between scans, never stopped/restarted) so saving a
  // reading returns straight to a live scanner with no extra tap — the
  // brief's "no extra taps between meters" would otherwise be undone by
  // requiring a fresh permission-adjacent start() for every single meter.
  useEffect(() => {
    return () => safeStopScanner(scannerRef.current);
  }, []);

  async function startCameraScan() {
    setScanError(null);
    setCameraState("starting");
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Camera didn't respond")), 8000)
    );

    try {
      await Promise.race([
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            try {
              scanner.pause(true);
            } catch (err) {
              console.error("Failed to pause scanner after decode", err);
            }
            handleScanned(decodedText);
          },
          () => {} // per-frame decode failure — expected constantly, not an error
        ),
        timeout,
      ]);
      setCameraState("active");
    } catch (err) {
      setCameraState("error");
      // html5-qrcode/getUserMedia rejections aren't always a plain Error
      // (a DOMException's .message can be empty, or it rejects with a
      // bare string) -- reproduced against a genuinely camera-blocked
      // browser, where this came back with no .message at all.
      const reason = err?.message || err?.name || String(err);
      setScanError(`Couldn't start the camera (${reason}) — use the code entry below instead.`);
      safeStopScanner(scanner);
    }
  }

  async function proceedWithMeter(found) {
    setMeter(found);

    if (navigator.onLine) {
      const today = await findTodaysReadingForMeter(found.id);
      if (today) {
        const time = new Date(today.read_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        setReReadNotice(`Already read today at ${time} — ${today.reading_value}. Re-read?`);
      } else {
        setReReadNotice(null);
      }
    } else {
      setReReadNotice(null);
    }

    await captureAndProcess(found);
  }

  async function handleScanned(qrCode) {
    setStep("working");
    setWorkingMessage("Looking up meter…");
    setScanError(null);

    const found = await resolveMeterByQrCode(qrCode);
    if (!found) {
      setScanError(`No active meter found for "${qrCode}". Check the label, or ask an admin to check the import.`);
      resetToScan();
      return;
    }
    await proceedWithMeter(found);
  }

  function handleSearchResultSelected(found) {
    setSearchQuery("");
    setSearchResults([]);
    setStep("working");
    setWorkingMessage("Looking up meter…");
    setScanError(null);
    proceedWithMeter(found);
  }

  async function captureAndProcess(meterRow) {
    setWorkingMessage("Opening camera…");
    let file;
    try {
      file = await capturePhoto();
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setScanError(err.message);
      resetToScan();
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPhoto({ file, previewUrl });

    setWorkingMessage("Getting location…");
    const loc = await getCurrentLocation();
    setLocation(loc);

    setWorkingMessage("Reading the dial…");
    const ocrResult = await recognizeDigits(file);
    setOcr(ocrResult);
    setReadingValue(ocrResult.text || "");

    setOverrideWarning(false);
    setOverrideNote("");
    setSaveError(null);
    setStep("confirm");
  }

  function resetToScan() {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setMeter(null);
    setPhoto(null);
    setReadingValue("");
    setOcr(null);
    setLocation(null);
    setReReadNotice(null);
    setOverrideWarning(false);
    setOverrideNote("");
    setSaveError(null);
    setStep("scan");
    if (cameraState === "active") {
      try {
        scannerRef.current?.resume();
      } catch (err) {
        console.error("Failed to resume camera", err);
      }
    }
  }

  const lastReading = meter?.last_reading != null ? Number(meter.last_reading) : null;
  const newReadingNum = readingValue === "" ? null : Number(readingValue);
  const usage = lastReading != null && newReadingNum != null ? newReadingNum - lastReading : null;
  const belowLast = lastReading != null && newReadingNum != null && newReadingNum < lastReading;
  const canSave = newReadingNum != null && !Number.isNaN(newReadingNum) && (!belowLast || overrideWarning);

  async function handleSave() {
    if (!canSave || !meter) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await submitReading({
        org_id: org.id,
        site_id: activeSite.id,
        meter_id: meter.id,
        reading_value: newReadingNum,
        read_at: new Date().toISOString(),
        photo_file: photo?.file || null,
        gps_lat: location?.denied ? null : location?.lat,
        gps_lng: location?.denied ? null : location?.lng,
        gps_accuracy_m: location?.denied ? null : location?.accuracy,
        gps_denied: Boolean(location?.denied),
        ocr_raw_text: ocr?.text || null,
        ocr_confidence: ocr?.confidence ?? null,
        reading_source: !ocr?.text ? "manual" : readingValue === ocr.text ? "ocr" : "ocr_corrected",
        taken_by_profile_id: profile.id,
        usage_warning_overridden: belowLast && overrideWarning,
        usage_warning_note: belowLast && overrideWarning ? overrideNote : null,
      });
      setLastSavedNotice(
        result.queued
          ? `${meter.pitches?.pitch_number_or_name} ${meter.meter_type} — queued, will sync when back online.`
          : `${meter.pitches?.pitch_number_or_name} ${meter.meter_type} — saved.`
      );
      resetToScan();
    } catch (err) {
      console.error("Failed to save reading", err);
      setSaveError(err.message || "Failed to save reading.");
    } finally {
      setSaving(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "var(--width-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <PageHeader title="Read a meter" />
        <Link to="/meter-reading/progress" style={{ color: colors.moss, fontSize: "var(--text-sm)" }}>Progress</Link>
      </div>

      {lastSavedNotice && (
        <p style={{ color: colors.moss, fontSize: "var(--text-base)" }}>{lastSavedNotice}</p>
      )}

      {/* Always mounted (never conditionally rendered on `step`) so
          html5-qrcode's DOM attachment survives switching to the
          working/confirm screens -- CSS visibility only, so the running
          camera is paused/resumed rather than torn down and restarted
          between scans. */}
      <Card pad="md" style={{ display: step === "scan" ? "block" : "none" }}>
        <div
          id={SCANNER_ELEMENT_ID}
          style={{ width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden", display: cameraState === "starting" || cameraState === "active" ? "block" : "none" }}
        />
        {(cameraState === "idle" || cameraState === "error") && (
          <Button variant="primary" block onClick={startCameraScan}>
            Scan with camera
          </Button>
        )}
        {cameraState === "starting" && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>Starting camera…</p>}
        {cameraState === "active" && (
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>
            Point the camera at the QR code on the meter box.
          </p>
        )}
        {scanError && <p style={{ color: colors.immediate, fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>{scanError}</p>}
      </Card>

      {step === "scan" && (
        <Card pad="md" style={{ marginTop: "var(--space-3)" }}>
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-xs)", margin: "0 0 var(--space-2)" }}>
            QR missing or damaged? Search by pitch or name instead.
          </p>
          <Input
            type="text"
            placeholder="e.g. PN-C01, or a customer name"
            aria-label="Search by pitch or customer name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div style={{ marginTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {searchResults.map((m) => (
                <Card
                  key={m.id}
                  as="button"
                  type="button"
                  interactive
                  pad="sm"
                  onClick={() => handleSearchResultSelected(m)}
                  style={{ textAlign: "left", width: "100%", font: "inherit", color: "inherit" }}
                >
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: colors.ink }}>
                    {m.pitches?.pitch_number_or_name} · {m.meter_type === "electric" ? "Electric" : "Gas"}
                  </div>
                  {m.customer_name && (
                    <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{m.customer_name}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <p style={{ color: colors.inkSoft, fontSize: "var(--text-xs)", margin: "var(--space-2) 0 0" }}>No matches.</p>
          )}
        </Card>
      )}

      {step === "working" && (
        <Card pad="lg" style={{ textAlign: "center" }}>
          <p style={{ color: colors.inkSoft }}>{workingMessage}</p>
        </Card>
      )}

      {step === "confirm" && meter && (
        <Card pad="md" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ fontFamily: fonts.display, fontSize: "var(--text-md)", color: colors.mossDark }}>
            {meter.pitches?.pitch_number_or_name} · {meter.meter_type === "electric" ? "Electric" : "Gas"}
          </div>

          {reReadNotice && (
            <p style={{ color: colors.gold, fontSize: "var(--text-sm)", fontWeight: 600 }}>{reReadNotice}</p>
          )}

          {photo?.previewUrl && (
            <img
              src={photo.previewUrl}
              alt="Meter dial"
              style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "var(--radius-sm)", background: colors.bg }}
            />
          )}

          <label style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
            Reading
            <input
              type="number"
              inputMode="decimal"
              value={readingValue}
              onChange={(e) => setReadingValue(e.target.value)}
              autoFocus
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                fontSize: "var(--text-xl)",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${colors.lineStrong}`,
                marginTop: "var(--space-1)",
              }}
            />
          </label>
          {ocr && !ocr.text && (
            <p style={{ color: colors.inkSoft, fontSize: "var(--text-xs)", margin: 0 }}>
              Couldn't read the dial automatically — enter it by hand.
            </p>
          )}

          <div style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
            Last reading: {lastReading != null ? lastReading : "—"}
            {meter.last_read_date ? ` (${new Date(meter.last_read_date).toLocaleDateString("en-GB")})` : ""}
          </div>
          {usage != null && (
            <div style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>Usage this period: {usage}</div>
          )}

          {belowLast && (
            <div style={{ background: colors.dangerSurface, border: `1px solid ${colors.dangerBorder}`, borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
              <p style={{ color: colors.immediate, fontWeight: 600, fontSize: "var(--text-sm)", margin: 0 }}>
                New reading is lower than the last recorded reading. Double-check the dial before overriding.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                <input type="checkbox" checked={overrideWarning} onChange={(e) => setOverrideWarning(e.target.checked)} />
                Save anyway
              </label>
              {overrideWarning && (
                <input
                  type="text"
                  placeholder="Why? (e.g. meter was replaced)"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: "var(--space-2)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", border: `1px solid ${colors.lineStrong}` }}
                />
              )}
            </div>
          )}

          {location?.denied && (
            <p style={{ color: colors.inkSoft, fontSize: "var(--text-xs)", margin: 0 }}>
              Location wasn't available — the reading will still save.
            </p>
          )}

          {saveError && <p style={{ color: colors.immediate, fontSize: "var(--text-sm)" }}>{saveError}</p>}

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button onClick={resetToScan}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Save & scan next"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
