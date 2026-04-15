import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initReplay } from "./replay.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Defer replay init until DOM is fully loaded to avoid rrweb's
// iframe-based CSS detection triggering Chrome security warnings
window.addEventListener("load", () => {
  try {
    initReplay();
  } catch (e) {
    console.warn("[session-replay] Failed to initialize:", e);
  }
});
