"use client";
import { useState } from "react";
import { PageSkeleton, PageTitle, TaskCard } from "@/components/common";
import { Ic } from "@/components/ui";
import { useAppState } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";

export default function Tasks() {
  const t = useT();
  const { lang } = useFarm();
  const { data: s } = useAppState();
  const [day, setDay] = useState<string | null>(null);
  if (!s) return <PageSkeleton />;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const letters = lang === "fr" ? ["di", "lu", "ma", "me", "je", "ve", "sa"] : (lang === "ar" || lang === "ary") ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const all = [...s.tasks].sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || a.when_date.localeCompare(b.when_date));
  const list = day ? all.filter((x) => x.when_date === day) : all;
  return (<>
    <PageTitle title={t("navTasks")} />
    <div className="mb-4 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {days.map((d, i) => { const k = iso(d), sel = day === k; return (
        <button key={k} type="button" onClick={() => setDay(sel ? null : k)} aria-pressed={sel} className={`relative flex min-h-16 min-w-12 flex-1 flex-col items-center justify-center rounded-2xl text-sm font-semibold ${sel ? "bg-sun text-amber-950 ring-[3px] ring-sun ring-offset-2" : i === 0 ? "bg-leaf text-paper" : "bg-soft text-muted"}`}>
          {letters[d.getDay()]}<b className={`text-[19px] ${sel || i === 0 ? "" : "text-ink"}`}>{d.getDate()}</b>
          {s.tasks.some((x) => x.when_date === k && x.status === "open") && <i className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${sel ? "bg-amber-950" : "bg-sun"}`} />}
        </button>); })}
    </div>
    <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] md:gap-x-4">
      {list.length ? list.map((x) => <TaskCard key={x.id} t={x} />) : <div className="card sub inline-flex items-center gap-2"><Ic name="check" size={18} /> {t("noTask")}</div>}
    </div>
  </>);
}
