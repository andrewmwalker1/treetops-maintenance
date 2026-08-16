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

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        resolve(await downscaleImage(file));
      } else {
        reject(new Error("No photo captured."));
      }
    };
    input.oncancel = () => reject(new Error("Photo capture cancelled."));

    input.click();
  });
}

// Phone cameras hand over multi-megapixel originals (several MB each) --
// with no resizing, every place that shows a photo (including an 80px
// list thumbnail) downloads the full original. Re-encoding down to a
// sane max dimension before upload fixes load times everywhere a photo
// is shown, not just the thumbnail, at a size increase small enough
// nobody who's ever seen a job photo would notice. Falls back to the
// original file on any failure (unsupported format, canvas error) so a
// resize bug never blocks the underlying capture.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

async function downscaleImage(file) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close?.();
      return file;
    }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
