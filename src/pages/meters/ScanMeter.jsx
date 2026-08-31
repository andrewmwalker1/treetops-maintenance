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
} from "../../lib/meterReadingsQuery.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

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
  const [manualCode, setManualCode] = useState("");
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

  function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualCode("");
    handleScanned(code);
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
    <div style={{ maxWidth: "480px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Read a meter</h1>
        <Link to="/meter-reading/progress" style={{ color: colors.moss, fontSize: "13px" }}>Progress</Link>
      </div>

      {lastSavedNotice && (
        <p style={{ color: colors.moss, fontSize: "14px" }}>{lastSavedNotice}</p>
      )}

      {/* Always mounted (never conditionally rendered on `step`) so
          html5-qrcode's DOM attachment survives switching to the
          working/confirm screens -- CSS visibility only, so the running
          camera is paused/resumed rather than torn down and restarted
          between scans. */}
      <div style={{ ...cardStyle, padding: "16px", display: step === "scan" ? "block" : "none" }}>
        <div
          id={SCANNER_ELEMENT_ID}
          style={{ width: "100%", borderRadius: "12px", overflow: "hidden", display: cameraState === "starting" || cameraState === "active" ? "block" : "none" }}
        />
        {(cameraState === "idle" || cameraState === "error") && (
          <button type="button" onClick={startCameraScan} style={{ ...buttonStyle.primary, width: "100%" }}>
            Scan with camera
          </button>
        )}
        {cameraState === "starting" && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>Starting camera…</p>}
        {cameraState === "active" && (
          <p style={{ color: colors.inkSoft, fontSize: "13px", marginTop: "12px" }}>
            Point the camera at the QR code on the meter box.
          </p>
        )}
        {scanError && <p style={{ color: colors.immediate, fontSize: "13px", marginTop: "8px" }}>{scanError}</p>}
      </div>

      {step === "scan" && (
        <form onSubmit={handleManualSubmit} style={{ ...cardStyle, padding: "16px", marginTop: "12px", display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="Or type the code, e.g. PN-C01-ELEC"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ flex: 1, boxSizing: "border-box", padding: "10px 14px", borderRadius: "10px", border: `1px solid ${colors.lineStrong}`, fontFamily: fonts.mono, fontSize: "14px" }}
          />
          <button type="submit" style={buttonStyle.secondary}>Look up</button>
        </form>
      )}

      {step === "working" && (
        <div style={{ ...cardStyle, padding: "24px", textAlign: "center" }}>
          <p style={{ color: colors.inkSoft }}>{workingMessage}</p>
        </div>
      )}

      {step === "confirm" && meter && (
        <div style={{ ...cardStyle, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark }}>
            {meter.pitches?.pitch_number_or_name} · {meter.meter_type === "electric" ? "Electric" : "Gas"}
          </div>

          {reReadNotice && (
            <p style={{ color: colors.gold, fontSize: "13px", fontWeight: 600 }}>{reReadNotice}</p>
          )}

          {photo?.previewUrl && (
            <img
              src={photo.previewUrl}
              alt="Meter dial"
              style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "10px", background: colors.bg }}
            />
          )}

          <label style={{ fontSize: "13px", color: colors.inkSoft }}>
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
                fontSize: "28px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: `1px solid ${colors.lineStrong}`,
                marginTop: "4px",
              }}
            />
          </label>
          {ocr && !ocr.text && (
            <p style={{ color: colors.inkSoft, fontSize: "12px", margin: 0 }}>
              Couldn't read the dial automatically — enter it by hand.
            </p>
          )}

          <div style={{ fontSize: "13px", color: colors.inkSoft }}>
            Last reading: {lastReading != null ? lastReading : "—"}
            {meter.last_read_date ? ` (${new Date(meter.last_read_date).toLocaleDateString("en-GB")})` : ""}
          </div>
          {usage != null && (
            <div style={{ fontSize: "13px", color: colors.inkSoft }}>Usage this period: {usage}</div>
          )}

          {belowLast && (
            <div style={{ background: "#F5E9E8", border: `1px solid ${colors.immediate}`, borderRadius: "10px", padding: "10px" }}>
              <p style={{ color: colors.immediate, fontWeight: 600, fontSize: "13px", margin: 0 }}>
                New reading is lower than the last recorded reading. Double-check the dial before overriding.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", marginTop: "8px" }}>
                <input type="checkbox" checked={overrideWarning} onChange={(e) => setOverrideWarning(e.target.checked)} />
                Save anyway
              </label>
              {overrideWarning && (
                <input
                  type="text"
                  placeholder="Why? (e.g. meter was replaced)"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: "8px", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${colors.lineStrong}` }}
                />
              )}
            </div>
          )}

          {location?.denied && (
            <p style={{ color: colors.inkSoft, fontSize: "12px", margin: 0 }}>
              Location wasn't available — the reading will still save.
            </p>
          )}

          {saveError && <p style={{ color: colors.immediate, fontSize: "13px" }}>{saveError}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={resetToScan} style={buttonStyle.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{ ...buttonStyle.primary, flex: 1, opacity: !canSave || saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save & scan next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
