import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
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
