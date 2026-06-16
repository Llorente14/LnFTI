"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const registerServiceWorker = () => {
      if (cancelled) {
        return;
      }

      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failure must never block app rendering.
      });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
