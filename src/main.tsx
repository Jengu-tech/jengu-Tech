import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// --- Service Worker registration (PWA) ---
// Désactivé en preview Lovable / iframe pour éviter les problèmes de cache.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") && host.startsWith("id-preview");

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost) {
    // Nettoie d'éventuels SW déjà enregistrés en preview
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    });
  }
}
