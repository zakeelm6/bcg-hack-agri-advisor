"use client";
// Field: the land with its layers, vigor over time (real Sentinel-2 series, direct labels, the demo goal named), tasks
// today, soil tests, weather with today and rain emphasised.
import { LandCard } from "@/components/Land";
import { SoilLine } from "@/components/SoilLine";
import { SeasonPlan } from "@/components/SeasonPlan";
import { PageSkeleton, PageTitle, TwoCol, locale, useFmt } from "@/components/common";
import { Badge, Button, Card, Icon, Label, Skeleton, Stat } from "@/components/ui";
import { openTasks, useAnomalies, useAppState, useLand, useSeries } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";

const ZCOL: Record<string, string> = { A: "var(--color-zone-a)", B: "var(--color-zone-b)", C: "var(--color-zone-c)", D: "var(--color-zone-d)" };

export default function Field() {
  const t = useT();
  const { lang } = useFarm();
  const { date, num } = useFmt();
  const { data: s } = useAppState();
  const { data: land } = useLand();
  const { data: anomalies } = useAnomalies();
  const { data: series, isFetched } = useSeries();
  if (!s) return <PageSkeleton />;
  const unsureZone = s.zones.find((z) => z.confidence !== "High");
  const wx = s.weather as { days: { date: string; rain: number; tmax: number; tmin: number }[]; fallback?: boolean };
  const n = openTasks(s).length;
  return (<>
    <PageTitle title={s.field.name} sub={t("ha", { n: num(s.field.area_ha, 1) })} />
    <TwoCol main={<div className="space-y-3">
      <LandCard s={s} land={land} anomalies={anomalies} margin={20} />
      <Card>
        <Label end={<Badge tone="outline">{t("goal", { v: "0.70" })}</Badge>}>{t("vigorOverTime")}</Label>
        {!isFetched && !series ? <Skeleton className="mt-3 h-52" /> : !series?.points.length ? <p className="mt-2 text-sm text-text-2">{series ? t("noSeries") : t("notSavedYet")}</p> : <Chart points={series.points as { zone_code: string; date: string; ndvi: number }[]} fmt={date} />}
      </Card>
    </div>} side={<div className="space-y-3">
      <Card className="flex items-center justify-between gap-3"><Stat value={n} label={t("tasksToday")} /><Button href="/tasks" variant={n ? "primary" : "secondary"} size="sm" iconEnd="chev">{t("seeTasks")}</Button></Card>
      <SeasonPlan />
      <Card>
        <Label>{t("soilTests")}</Label>
        <div className="mt-2 space-y-1 text-sm text-text-2">{s.soil_tests.length ? s.soil_tests.map((x) => <div key={x.zone_code}><SoilLine test={x} /></div>) : <p>{t("noneYet")}</p>}</div>
        <Button href={`/field/soil/${unsureZone?.code ?? "A"}`} variant={unsureZone ? "accent" : "secondary"} icon="flask" className="mt-3" full>{t("addSoilTest")}</Button>
        {unsureZone && <p className="mt-2 text-xs text-text-3">{t("soilHint", { z: unsureZone.code })}</p>}
      </Card>
      <Button href="/me#land" variant="secondary" icon="walk" full>{t("drawField")}</Button>
      <Card>
        <Label end={wx.fallback ? <Badge tone="simulated">{t("weatherFallback")}</Badge> : <Badge icon="cloud">Open-Meteo</Badge>}>{t("weather")}</Label>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {wx.days.map((d, i) => { const rain = d.rain >= 1; return (
            <div key={d.date} className={`flex flex-col items-center rounded-lg px-1 py-2 text-center ${i === 0 ? "bg-brand-soft text-brand ring-1 ring-brand/30" : rain ? "bg-info-soft text-on-info-soft" : "bg-surface-2 text-text-2"}`}>
              <span className="text-[11px] font-semibold uppercase">{i === 0 ? t("today") : new Date(d.date + "T12:00:00").toLocaleDateString(locale(lang), { weekday: "short" }).replace(".", "")}</span>
              <Icon name={rain ? "rain" : "sun"} size={20} className="my-1" />
              <b className="num text-sm text-text">{Math.round(d.tmax)}°</b>
              <span className="num text-[11px]">{rain ? `${d.rain.toFixed(0)} mm` : "–"}</span>
            </div>); })}
        </div>
      </Card>
    </div>} />
  </>);
}

function Chart({ points, fmt }: { points: { zone_code: string; date: string; ndvi: number }[]; fmt: (iso: string) => string }) {
  const t = useT();
  const zones = [...new Set(points.map((p) => p.zone_code))].sort();
  const tm = (d: string) => new Date(d + "T12:00:00").getTime();
  const t0 = Math.min(...points.map((p) => tm(p.date))), t1 = Math.max(...points.map((p) => tm(p.date)));
  const ymin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.ndvi)) - 0.05) * 10) / 10), ymax = 1;
  const W = 560, H = 280, L = 40, R = 64, T = 16, B = 40;
  const X = (ms: number) => L + (t1 === t0 ? 0.5 : (ms - t0) / (t1 - t0)) * (W - L - R), Y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const step = ymax - ymin > 0.55 ? 0.2 : 0.1, grid: number[] = [];
  for (let v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) grid.push(Math.round(v * 100) / 100);
  const dates = [...new Set(points.map((p) => p.date))].sort(); let lastX = -999; const labels: string[] = [];
  dates.forEach((d, i) => { const x = X(tm(d)); if (x - lastX >= 70 && (i === 0 || W - R - x >= 24 || i === dates.length - 1)) { labels.push(d); lastX = x; } });
  const latest = zones.map((z) => { const zp = points.filter((p) => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date)); return { z, v: zp[zp.length - 1].ndvi }; });
  const low = latest.reduce((a, b) => (b.v < a.v ? b : a)), others = latest.filter((x) => x.z !== low.z);
  const gap = others.length ? others.reduce((a, b) => a + b.v, 0) / others.length - low.v : 0;
  // direct labels at the line ends, nudged apart so they never overlap (14 px minimum)
  const labelY: Record<string, number> = {};
  [...latest].sort((a, b) => Y(a.v) - Y(b.v)).reduce((prev, cur) => { const y = Math.max(Y(cur.v), prev + 14); labelY[cur.z] = y; return y; }, -Infinity);
  return (<>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("vigorOverTime")} style={{ direction: "ltr" }} className="num mt-2 text-text-2">
      {grid.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="currentColor" strokeOpacity=".15" /><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="13" fill="currentColor">{v.toFixed(1)}</text></g>)}
      {0.7 > ymin && <g><line x1={L} x2={W - R} y1={Y(0.7)} y2={Y(0.7)} stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 4" /><text x={W - R} y={Y(0.7) - 6} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-accent-strong)">{t("goal", { v: "0.70" })}</text></g>}
      {labels.map((d) => <text key={d} x={X(tm(d))} y={H - 14} textAnchor="middle" fontSize="13" fill="currentColor">{fmt(d)}</text>)}
      {zones.map((z) => { const zp = points.filter((p) => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date)); const last = zp[zp.length - 1]; const weak = z === low.z && gap > 0.05; return (
        <g key={z} opacity={weak || gap <= 0.05 ? 1 : 0.75}><polyline fill="none" stroke={ZCOL[z]} strokeWidth={weak ? 3 : 2.25} strokeLinejoin="round" strokeLinecap="round" points={zp.map((p) => `${X(tm(p.date)).toFixed(1)},${Y(p.ndvi).toFixed(1)}`).join(" ")} />
          {zp.map((p) => <circle key={p.date} cx={X(tm(p.date))} cy={Y(p.ndvi)} r="3.2" fill="var(--color-surface)" stroke={ZCOL[z]} strokeWidth="2"><title>{z}, {fmt(p.date)}: {p.ndvi.toFixed(2)}</title></circle>)}
          <text x={X(tm(last.date)) + 8} y={labelY[z] + 4} fontSize="13" fontWeight="700" fill={ZCOL[z]}>{z} {last.ndvi.toFixed(2)}</text></g>); })}
    </svg>
    {gap > 0.05 && <p className="mt-1 text-sm"><b>{t("lowest", { z: low.z, v: low.v.toFixed(2) })}</b> <span className="text-text-2">{t("lowestNote")}</span></p>}
  </>);
}
