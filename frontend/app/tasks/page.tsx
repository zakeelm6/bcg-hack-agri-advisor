"use client";
// Tasks: the week strip filters by day; open tasks first, grouped by day; done and skipped under their own heading.
import { useState } from "react";
import { PageSkeleton, PageTitle, TaskCard, useFmt } from "@/components/common";
import { Button, EmptyState } from "@/components/ui";
import { useAppState } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { locale } from "@/components/common";

export default function Tasks() {
  const t = useT();
  const { lang } = useFarm();
  const { dayWord } = useFmt();
  const { data: s } = useAppState();
  const [day, setDay] = useState<string | null>(null);
  if (!s) return <PageSkeleton />;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const wd = (d: Date) => d.toLocaleDateString(locale(lang), { weekday: "short" }).replace(".", "");
  const open = s.tasks.filter((x) => x.status === "open" && (!day || x.when_date === day)).sort((a, b) => a.when_date.localeCompare(b.when_date));
  const closed = s.tasks.filter((x) => x.status !== "open" && (!day || x.when_date === day));
  const groups = [...new Set(open.map((x) => x.when_date))];
  return (<>
    <PageTitle title={t("navTasks")} sub={t("tasksSub", { n: s.tasks.filter((x) => x.status === "open").length })} />
    <div role="radiogroup" aria-label={t("navTasks")} className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto md:max-w-xl">
      {days.map((d, i) => { const k = iso(d), sel = day === k, has = s.tasks.some((x) => x.when_date === k && x.status === "open"); return (
        <button key={k} type="button" role="radio" aria-checked={sel} onClick={() => setDay(sel ? null : k)}
          className={`pressable relative flex min-h-[68px] min-w-[52px] flex-1 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition-colors ${sel ? "border-brand bg-brand-strong text-on-brand" : i === 0 ? "border-line-strong bg-surface text-text" : "border-line bg-surface text-text-2 hover:bg-surface-2"}`}>
          <span>{wd(d)}</span><b className={`num text-xl ${sel ? "" : "text-text"}`}>{d.getDate()}</b>
          {has && <i aria-hidden className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${sel ? "bg-accent" : "bg-accent"}`} />}
        </button>); })}
    </div>
    <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] md:gap-x-5">
      {groups.map((g) => (
        <section key={g} className="mb-4 md:col-span-full">
          <h2 className="mb-2 px-1 text-sm font-bold text-text-2">{dayWord(g)}</h2>
          <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] md:gap-x-5">{open.filter((x) => x.when_date === g).map((x) => <TaskCard key={x.id} t={x} />)}</div>
        </section>
      ))}
      {!open.length && <div className="md:col-span-full"><EmptyState icon="check" tone="success" title={t("allGood")} action={<Button href="/home" variant="secondary" size="sm" icon="home">{t("navHome")}</Button>}>{t("noTaskToday")}</EmptyState></div>}
      {closed.length > 0 && (
        <section className="mt-2 md:col-span-full">
          <h2 className="mb-2 px-1 text-sm font-bold text-text-2">{t("doneSection")}</h2>
          <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] md:gap-x-5">{closed.map((x) => <TaskCard key={x.id} t={x} />)}</div>
        </section>
      )}
    </div>
  </>);
}
