import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// This is a desktop app, not a web page: no browser context menu (Back/Refresh/Inspect),
// except where copy/paste is useful.
const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.closest("input, textarea, [contenteditable=true]") !== null || window.getSelection()?.toString() !== "");
window.addEventListener("contextmenu", (e) => {
  if (!editable(e.target)) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
