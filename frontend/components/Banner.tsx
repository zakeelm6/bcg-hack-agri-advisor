"use client";
// Offline banner: calm, says how old the saved advice is and that actions are kept on the phone.
import { useActions, useAppState, useOffline } from "@/lib/data";
import { useT } from "@/lib/farm";
import { Ic } from "./ui";

export function agoKey(t: (k: "justNow" | "minAgo" | "hAgo" | "daysAgo", v?: Record<string, number>) => string, iso?: string | null) {
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
    <div role="status" className="mb-3 flex items-center gap-3 rounded-2xl bg-sun px-4 py-3 text-amber-950">
      <Ic name="cloudoff" size={26} />
      <div>
        <b className="block">{offline ? t("offline") : t("sending")}</b>
        {offline && s?.generated_at && <span className="block text-xs">{t("offlineAdvice", { age: agoKey(t, s.generated_at) })}</span>}
        {queued > 0 && <span className="block text-xs">{t("willSync", { n: queued, when: offline ? t("whenOnline") : t("now") })}</span>}
      </div>
    </div>
  );
}
