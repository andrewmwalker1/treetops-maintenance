// Standard file-input capture. No other file should reference
// `<input type="file" capture>` directly — swapping this module's
// internals is how a future Capacitor build adds native camera access
// without touching calling code.

export function capturePhoto() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";

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
