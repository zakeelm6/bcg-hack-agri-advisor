"use client";
// Offline status: calm and neutral. Says what is shown (advice saved X ago) and that actions are kept on the phone. Never amber:
// amber is the action colour of the screen.
import { useActions, useAppState, useOffline } from "@/lib/data";
import { useT } from "@/lib/farm";
import type { Key } from "@/lib/i18n";
import { Banner as UiBanner } from "./ui";

export function agoKey(t: (k: Key, v?: Record<string, number>) => string, iso?: string | null) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 60000));
  if (min < 2) return t("justNow");
  if (min < 60) return t("minAgo", { n: min });
  if (min < 36 * 60) return t("hAgo", { n: Math.round(min / 60) });
  return t("daysAgo", { n: Math.round(min / 1440) });
}

export function Banner() {
  const t = useT();
  const offline = useOffline();
  const { queued } = useActions();
  const { data: s } = useAppState();
  if (!offline && !queued) return null;
  return (
    <UiBanner tone="info" icon={offline ? "cloudoff" : "refresh"} title={offline ? t("offline") : t("sending")} className="anim-fade-in mb-3">
      {offline && s?.generated_at && <span className="block">{t("offlineAdvice", { age: agoKey(t, s.generated_at) })}</span>}
      {queued > 0 && <span className="block">{t("willSync", { n: queued, when: offline ? t("whenOnline") : t("now") })}</span>}
    </UiBanner>
  );
}
