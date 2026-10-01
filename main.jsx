import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import "./src/styles/tokens.css";
import "./src/styles/base.css";
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
//
// It also checks whenever the app comes back into view -- switching back
// to the tab, reopening the installed app, unlocking the phone -- since
// the hourly check alone left people on an old version for up to an hour
// after a deploy (Andy, 1 Oct 2026). Throttled to once a minute so
// flicking between apps doesn't hammer the server. When a check finds a
// new version, sw.js's skipWaiting/clientsClaim plus autoUpdate reload the
// page onto it straight away.
const UPDATE_CHECK_MIN_GAP_MS = 60 * 1000;

registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    let lastCheck = Date.now();
    const checkForUpdate = () => {
      if (Date.now() - lastCheck < UPDATE_CHECK_MIN_GAP_MS) return;
      lastCheck = Date.now();
      registration.update().catch(() => {}); // offline -- try again next time
    };
    setInterval(checkForUpdate, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
  },
});
