"use client";

import { useEffect, useState } from "react";

export function OfflineRetryButton() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
        {isOnline ? "Koneksi kembali tersedia." : "Perangkat ini tampaknya masih offline."}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!isOnline}
      >
        Coba lagi
      </button>
    </div>
  );
}
