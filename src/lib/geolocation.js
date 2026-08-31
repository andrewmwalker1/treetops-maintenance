// Wraps the Geolocation API as a promise that always resolves (never
// rejects) — a reading must still save when location is denied or
// unavailable, just flagged gps_denied rather than blocking the save.

export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ denied: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          denied: false,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve({ denied: true }),
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}
