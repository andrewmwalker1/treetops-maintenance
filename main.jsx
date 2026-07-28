import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./src/App.jsx";
import { flushQueue } from "./src/platform/syncQueue.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

flushQueue();
window.addEventListener("online", () => flushQueue());

// registerType: "autoUpdate" (vite.config.js) only takes effect via this
// helper -- without it the browser was falling back to a bare SW
// registration that never checks for updates again after the first load,
// so people leaving the app open all day never got deployed fixes.
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});
