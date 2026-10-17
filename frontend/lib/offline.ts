"use client";

// What the farmer should know about the connection: is the phone offline, and is something waiting to be sent.
import { useEffect, useState } from "react";
import { API } from "./api";
import { flush, onQueueChange, pendingCount } from "./queue";

export function useOfflineStatus() {
  const [s, setS] = useState({ online: true, pending: 0 });
  useEffect(() => {
    const update = () => setS({ online: navigator.onLine, pending: pendingCount() });
    update();
    const off = onQueueChange(update);
    const back = () => { update(); void flush(); };   // the connection is back: send what waits
    window.addEventListener("online", back);
    window.addEventListener("offline", update);
    const timer = setInterval(() => { if (pendingCount() > 0 && navigator.onLine) void flush(); }, 20000);   // a server that was down for a while
    return () => { off(); window.removeEventListener("online", back); window.removeEventListener("offline", update); clearInterval(timer); };
  }, []);
  return { ...s, enabled: !!API };
}

/** Registers the service worker that lets the app open with no network. Production only: in development it would serve old files. */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => { /* the app works the same without it, only not offline */ });
}
