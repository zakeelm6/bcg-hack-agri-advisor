"use client";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageSkeleton, PageTitle } from "@/components/common";
import { Circle, Ic } from "@/components/ui";
import { writeCache, type StateOut } from "@/lib/api";
import { stateKey, useAppState } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";

export default function Alerts() {
  const t = useT();
  const { lang } = useFarm();
  const { data: s } = useAppState();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "weather" | "crop" | "data">("all");
  if (!s) return <PageSkeleton />;
  const markRead = (id: number) => { const n = structuredClone(s) as StateOut; n.alerts.forEach((a) => { if (a.id === id) a.unread = 0; }); qc.setQueryData(["state", stateKey(lang)], n); writeCache(stateKey(lang), n); };
  const target = (key: string) => (key.startsWith("sample:") || key.startsWith("ph:") || key.startsWith("sensor:") ? `/field/soil/${key.split(":")[1]}` : null);
  const icon: Record<string, string> = { weather: "cloud", crop: "search", data: "flask" };
  const list = s.alerts.filter((a) => filter === "all" || a.kind === filter);
  return (<>
    <PageTitle title={t("navAlerts")} />
    <div className="mb-3 flex flex-wrap gap-2">{(["all", "weather", "crop", "data"] as const).map((k) => <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`chip ${filter === k ? "chip-on" : ""}`}>{t(k === "all" ? "all" : k === "weather" ? "kindWeather" : k === "crop" ? "kindCrop" : "kindData")}</button>)}</div>
    <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] md:gap-x-4">
      {list.length ? list.map((a) => (
        <div key={a.id} className={`card flex items-start gap-3 ${a.unread ? "" : "[&_.ttl]:opacity-60"}`}>
          <Circle tone={a.kind === "crop" ? "amber" : "soft"}><Ic name={icon[a.kind] ?? "bell"} size={26} /></Circle>
          <div className="min-w-0 flex-1"><div className="ttl text-lg font-bold leading-tight">{a.title}</div><div className="sub">{a.body}</div>
            {target(a.key) && <Link href={target(a.key)!} onClick={() => markRead(a.id)} className="btn-sec btn-sm mt-2.5"><Ic name="flask" size={18} /> {t("addSoilTest")}</Link>}</div>
          {!!a.unread && <button type="button" onClick={() => markRead(a.id)} aria-label={t("markRead")} className="pill min-h-11 min-w-12 justify-center">{t("newAlert")}</button>}
        </div>
      )) : <div className="card sub inline-flex items-center gap-2"><Ic name="check" size={18} /> {t("noAlerts")}</div>}
    </div>
  </>);
}
