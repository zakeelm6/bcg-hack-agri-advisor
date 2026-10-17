"use client";
// ConfidenceMeter: how sure the advice is. Three segments plus the word, never colour alone; the reason on demand.
import { useT } from "@/lib/farm";

export function ConfidenceMeter({ conf, reason, size = "md", onDark }: { conf: string; reason?: string; size?: "sm" | "md"; onDark?: boolean }) {
  const t = useT();
  const lvl = ({ High: 3, Medium: 2, Low: 1 } as Record<string, number>)[conf] ?? 1;
  const word = conf === "High" ? t("confHigh") : conf === "Medium" ? t("confMedium") : t("confLow");
  const seg = size === "sm" ? "h-1.5 w-5" : "h-2 w-8";
  return (
    <span className={`inline-flex items-center gap-2 ${size === "sm" ? "text-xs" : "text-sm"} font-semibold`} title={reason}>
      <span className="flex gap-1" role="img" aria-label={`${t("howSure")}: ${word}`}>
        {[1, 2, 3].map((i) => <i key={i} className={`block rounded-full ${seg} ${onDark ? "bg-current" : "bg-brand"} ${i <= lvl ? "" : "opacity-25"}`} />)}
      </span>
      <span>{word}</span>
    </span>
  );
}
