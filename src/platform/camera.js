// Standard file-input capture. No other file should reference
// `<input type="file">` directly — swapping this module's internals is
// how a future Capacitor build adds native camera access without
// touching calling code.
//
// Deliberately omits the `capture` attribute: setting it forces mobile
// browsers straight into the camera with no option to pick an existing
// photo. Leaving it off lets iOS/Android show their normal "Take Photo
// or Choose from Library" picker instead, while desktop just gets a
// regular file browser.

export function capturePhoto() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("No photo captured."));
      }
    };
    input.oncancel = () => reject(new Error("Photo capture cancelled."));

    input.click();
  });
}
