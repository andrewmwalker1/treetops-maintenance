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

export default function ScanMeter() {
  const { profile, org, activeSite } = useAuth();
  const [step, setStep] = useState("scan"); // scan | working | confirm
  const [scanError, setScanError] = useState(null);
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

  useEffect(() => {
    if (step !== "scan" || !activeSite) return;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().catch(() => {});
          handleScanned(decodedText);
        },
        () => {} // per-frame decode failure — expected constantly, not an error
      )
      .catch((err) => setScanError("Couldn't start the camera: " + err.message));

    return () => {
      stopped = true;
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeSite]);

  async function handleScanned(qrCode) {
    setStep("working");
    setWorkingMessage("Looking up meter…");
    setScanError(null);

    const found = await resolveMeterByQrCode(qrCode);
    if (!found) {
      setScanError(`No active meter found for "${qrCode}". Check the label, or ask an admin to check the import.`);
      setStep("scan");
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
      setStep("scan");
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
        <Link to="/meters/progress" style={{ color: colors.moss, fontSize: "13px" }}>Progress</Link>
      </div>

      {lastSavedNotice && (
        <p style={{ color: colors.moss, fontSize: "14px" }}>{lastSavedNotice}</p>
      )}

      {step === "scan" && (
        <div style={{ ...cardStyle, padding: "16px" }}>
          <div id={SCANNER_ELEMENT_ID} style={{ width: "100%", borderRadius: "12px", overflow: "hidden" }} />
          <p style={{ color: colors.inkSoft, fontSize: "13px", marginTop: "12px" }}>
            Point the camera at the QR code on the meter box.
          </p>
          {scanError && <p style={{ color: colors.immediate, fontSize: "13px" }}>{scanError}</p>}
        </div>
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
