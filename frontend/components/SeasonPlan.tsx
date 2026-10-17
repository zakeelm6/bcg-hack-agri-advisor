"use client";
// The season plan: stages as a timeline, the current one highlighted, planned tasks per stage, the assumptions behind it.
import { useState } from "react";
import { useFmt } from "@/components/common";
import { useSeason } from "@/lib/data";
import { useT } from "@/lib/farm";
import { Badge, Card, Icon, Label, Skeleton, taskIcon } from "./ui";

export function SeasonPlan() {
  const t = useT();
  const { date } = useFmt();
  const { data: p, isFetched } = useSeason();
  const [open, setOpen] = useState<string | null>(null);
  if (!p) return isFetched ? null : <Skeleton className="h-40" />;
  const cur = p.stages.find((s) => (s as { current?: boolean }).current) as { stage: string } | undefined;
  return (
    <Card>
      <Label end={<Badge tone="outline">{t("demo")}</Badge>}>{t("seasonPlan")}</Label>
      <p className="mt-1.5 font-display text-lg">{t("seasonNow", { stage: p.stage.label as string, w: p.week })}</p>
      <p className="text-sm text-text-2">{t("seasonHarvest", { d: date(p.harvest_date) })} · {p.crop}</p>
      <ol className="mt-3 flex gap-1" aria-label={t("seasonPlan")}>
        {p.stages.map((s) => { const st = s as { stage: string; stage_label: string; days: number; current?: boolean }; const on = open ? open === st.stage : !!st.current; return (
          <li key={st.stage} className="min-w-0" style={{ flex: Math.max(st.days, 7) }}>
            <button type="button" onClick={() => setOpen(open === st.stage ? null : st.stage)} aria-pressed={on} className={`pressable block w-full rounded-md px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors ${on ? "bg-brand-strong text-on-brand" : st.current ? "bg-brand-soft text-brand" : "bg-surface-2 text-text-2 hover:bg-surface-3"}`}>
              <span className="block truncate">{st.stage_label}</span><span className="num block opacity-80">{t("stageDays", { n: st.days })}</span>
            </button>
          </li>); })}
      </ol>
      {(() => { const sel = (p.stages as { stage: string; stage_label: string; start: string; end: string; tasks: { type: string; text: string }[] }[]).find((s) => s.stage === (open ?? cur?.stage)); if (!sel) return null; return (
        <div className="anim-fade-up mt-3 rounded-lg bg-surface-2 p-3">
          <p className="text-sm font-semibold">{sel.stage_label} <span className="num font-normal text-text-2">· {date(sel.start)} – {date(sel.end)}</span></p>
          <ul className="mt-2 space-y-1.5">{sel.tasks.map((x, i) => <li key={i} className="flex items-start gap-2 text-sm"><Icon name={taskIcon(x.type)} size={16} className="mt-0.5 flex-none text-brand" /><span>{x.text}</span></li>)}</ul>
        </div>); })()}
      <details className="mt-2 border-t-0"><summary className="text-sm text-text-2">{t("seasonAssumptions")}</summary>
        <ul className="list-disc space-y-1 ps-5 pb-2 text-xs text-text-2">{(p.assumptions as string[]).map((a, i) => <li key={i}>{a}</li>)}</ul>
        <p className="pb-2 text-xs text-text-3">{t("seasonNote")}</p>
      </details>
    </Card>
  );
}
