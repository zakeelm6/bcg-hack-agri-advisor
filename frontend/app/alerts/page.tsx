"use client";
// Alerts: a segmented filter, unread marked by a dot and weight (never colour alone), the fix as an action inside the card.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageSkeleton, PageTitle } from "@/components/common";
import { Button, EmptyState, Icon, Segmented } from "@/components/ui";
import { writeCache, type StateOut } from "@/lib/api";
import { stateKey, useAppState } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";

type F = "all" | "weather" | "crop" | "data";
export default function Alerts() {
  const t = useT();
  const { lang } = useFarm();
  const { data: s } = useAppState();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<F>("all");
  if (!s) return <PageSkeleton />;
  const markRead = (id: number) => { const n = structuredClone(s) as StateOut; n.alerts.forEach((a) => { if (a.id === id) a.unread = 0; }); qc.setQueryData(["state", stateKey(lang)], n); writeCache(stateKey(lang), n); };
  const target = (key: string) => (key.startsWith("sample:") || key.startsWith("ph:") || key.startsWith("sensor:") ? `/field/soil/${key.split(":")[1]}` : null);
  const icon: Record<string, string> = { weather: "cloud", crop: "search", data: "flask" };
  const list = s.alerts.filter((a) => filter === "all" || a.kind === filter);
  const unread = s.alerts.filter((a) => a.unread).length;
  return (<>
    <PageTitle title={t("navAlerts")} sub={unread ? t("unreadN", { n: unread }) : undefined} />
    <div className="mb-4"><Segmented<F> label={t("navAlerts")} value={filter} onChange={setFilter} options={[{ id: "all", label: t("all") }, { id: "weather", label: t("kindWeather"), icon: "cloud" }, { id: "crop", label: t("kindCrop"), icon: "search" }, { id: "data", label: t("kindData"), icon: "flask" }]} /></div>
    <div className="md:grid md:grid-cols-2 md:gap-3">
      {list.length ? list.map((a) => (
        <article key={a.id} className={`anim-fade-up mb-3 flex items-start gap-3 rounded-xl border border-line bg-surface p-4 md:mb-0 ${a.unread ? "" : "opacity-80"}`}>
          <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${a.kind === "crop" ? "bg-accent-soft text-accent-strong" : a.kind === "data" ? "bg-info-soft text-info" : "bg-surface-2 text-text-2"}`}><Icon name={icon[a.kind] ?? "bell"} size={24} /></span>
          <div className="min-w-0 flex-1">
            <h2 className={`flex items-center gap-2 text-base leading-tight ${a.unread ? "font-bold" : "font-semibold text-text-2"}`}>{!!a.unread && <i aria-hidden className="h-2 w-2 flex-none rounded-full bg-accent" />}{a.title}{!!a.unread && <span className="sr-only">({t("newAlert")})</span>}</h2>
            <p className="mt-1 text-sm text-text-2">{a.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {target(a.key) && <Button href={target(a.key)!} size="sm" variant="secondary" icon="flask" onClick={() => markRead(a.id)}>{t("addSoilTest")}</Button>}
              {!!a.unread && <Button size="sm" variant="ghost" icon="check" onClick={() => markRead(a.id)}>{t("markRead")}</Button>}
            </div>
          </div>
        </article>
      )) : <div className="md:col-span-2"><EmptyState icon="bell" title={t("noAlerts")}>{t("noAlertsBody")}</EmptyState></div>}
    </div>
  </>);
}
