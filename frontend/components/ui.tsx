"use client";
// Small building blocks shared by the screens: stroke icons, the 3-level confidence meter (shape + word, never colour alone),
// honest tags, toasts. Touch targets are 48 px or more.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useT } from "@/lib/farm";

export const ICONS: Record<string, string> = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  tasks: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  sell: '<path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7zM8 9l3-5M16 9l-3-5"/>',
  bell: '<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-4 5-7 9-9"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/>',
  sack: '<path d="M8 4h8l2 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8zM6 8h12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  cloudoff: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18zM3 3l18 18"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18zM9 21l-1 2M13 21l-1 2M17 21l-1 2"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>',
  truck: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  school: '<path d="M3 10l9-6 9 6M5 10v9h14v-9M10 19v-5h4v5"/>',
  coop: '<path d="M3 20V9l9-5 9 5v11M9 20v-6h6v6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  walk: '<path d="M4 18c3-8 8-2 11-8s3-3 5-4"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="6" r="1.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
};
export const taskIcon = (type: string) => ({ irrigate: "drop", fertilize: "sack", inspect: "search" }[type] ?? "check");

export function Ic({ name, size = 24, w = 2, className }: { name: string; size?: number; w?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />;
}

export function Meter({ conf, small, light }: { conf: string; small?: boolean; light?: boolean }) {
  const t = useT();
  const lvl = ({ High: 3, Medium: 2, Low: 1 } as Record<string, number>)[conf] ?? 1;
  const word = conf === "High" ? t("confHigh") : conf === "Medium" ? t("confMedium") : t("confLow");
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${small ? "text-xs" : "text-sm"}`}>
      <span className="flex gap-1" role="img" aria-label={t("howSure")}>
        {[1, 2, 3].map((i) => <i key={i} className={`block rounded-full ${small ? "h-2 w-5" : "h-2.5 w-10"} ${light ? "bg-current" : "bg-sun"} ${i <= lvl ? "" : "opacity-25"}`} />)}
      </span>
      <span>{word}</span>
    </span>
  );
}

export const Tag = ({ warn, children }: { warn?: boolean; children: React.ReactNode }) => (
  <span className={`me-1.5 mt-1 inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold ${warn ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-soft text-muted"}`}>{children}</span>
);

export const Circle = ({ tone = "soft", size = 52, children }: { tone?: "soft" | "amber" | "green"; size?: number; children: React.ReactNode }) => (
  <span className={`grid flex-none place-items-center rounded-full ${tone === "amber" ? "bg-sun text-amber-950" : tone === "green" ? "bg-leaf text-paper" : "bg-page text-leaf"}`} style={{ width: size, height: size }}>{children}</span>
);

// ---------------------------------------------------------------- toasts (with an optional action such as Undo)
type Toast = { id: number; text: string; action?: { label: string; fn: () => void } };
const ToastCtx = createContext<(text: string, action?: Toast["action"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, action?: Toast["action"]) => {
    setToasts((ts) => (ts.some((x) => x.action) && !action ? ts : [{ id: Date.now(), text, action }]));   // a plain note never replaces an Undo
  }, []);
  useEffect(() => { if (!toasts.length) return; const t = setTimeout(() => setToasts([]), toasts[0].action ? 6000 : 3200); return () => clearTimeout(t); }, [toasts]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toasts.map((x) => (
        <div key={x.id} role="status" className="fixed bottom-24 start-1/2 z-[80] flex max-w-[380px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-leaf-dark px-5 py-3 text-sm text-paper shadow-xl rtl:translate-x-1/2 md:bottom-9">
          <span>{x.text}</span>
          {x.action && <button type="button" onClick={() => { setToasts([]); x.action!.fn(); }} className="min-h-10 flex-none rounded-full bg-sun px-4 font-bold text-amber-950">{x.action.label}</button>}
        </div>
      ))}
    </ToastCtx.Provider>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div role="status" className={`animate-pulse rounded-2xl bg-leaf/10 ${className}`} />;
