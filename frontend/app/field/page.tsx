"use client";
// Field: the land with its layers, vigor over time (real Sentinel-2 series), tasks today, soil tests, weather.
import Link from "next/link";
import { LandCard } from "@/components/Land";
import { PageSkeleton, PageTitle, useFmt } from "@/components/common";
import { Ic, Skeleton } from "@/components/ui";
import { openTasks, useAnomalies, useAppState, useLand, useSeries } from "@/lib/data";
import { useT } from "@/lib/farm";
import { SoilLine } from "@/components/SoilLine";

const ZCOL: Record<string, string> = { A: "#31572C", B: "#B97F17", C: "#2E7D74", D: "#B5472B" };

export default function Field() {
  const t = useT();
  const { date } = useFmt();
  const { data: s } = useAppState();
  const { data: land } = useLand();
  const { data: anomalies } = useAnomalies();
  const { data: series, isFetched } = useSeries();
  if (!s) return <PageSkeleton />;
  const unsure = s.zones.some((z) => z.confidence !== "High");
  const wx = s.weather as { days: { date: string; rain: number; tmax: number }[] };
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (<>
    <PageTitle title={s.field.name} />
    <div className="grid2">
      <div>
        <LandCard s={s} land={land} anomalies={anomalies} margin={20} />
        <div className="card"><div className="label">{t("vigorOverTime")}</div>
          {!isFetched && !series ? <Skeleton className="mt-2 h-44" /> : !series?.points.length ? <div className="sub mt-1.5">{series ? t("noSeries") : t("notSavedYet")}</div> : <Chart points={series.points as { zone_code: string; date: string; ndvi: number }[]} fmt={date} />}
        </div>
      </div>
      <div>
        <div className="card flex items-center justify-between"><div><div className="text-[44px] font-bold leading-none">{openTasks(s).length}</div><div className="sub">{t("tasksToday")}</div></div><Link href="/tasks" className="btn-sec btn-sm">{t("seeTasks")}</Link></div>
        <div className="card"><div className="label">{t("soilTests")}</div>
          <div className="sub my-1.5 mb-2.5">{s.soil_tests.length ? s.soil_tests.map((x) => <div key={x.zone_code}><SoilLine test={x} /></div>) : t("noneYet")}</div>
          <Link href={`/field/soil/${s.zones.find((z) => z.confidence !== "High")?.code ?? "A"}`} className={`${unsure ? "btn" : "btn-sec"} btn-sm`}><Ic name="flask" size={18} /> {t("addSoilTest")}</Link>
        </div>
        <div className="card"><div className="label">{t("weather")}</div>
          <div className="mt-2 flex gap-1.5">{wx.days.map((d, i) => <div key={d.date} className={`flex-1 rounded-2xl bg-soft px-0.5 py-2 text-center text-xs text-muted ${i === 0 ? "font-bold text-ink outline outline-2 -outline-offset-2 outline-leaf" : ""}`}>{i === 0 ? t("today") : t(("wd" + WD[new Date(d.date + "T12:00:00").getDay()]) as "wdMon")}<b className="block min-h-[22px] text-sm text-ink">{d.rain ? `${d.rain.toFixed(0)} mm` : <Ic name="sun" size={16} className="mx-auto" />}</b>{Math.round(d.tmax)}°</div>)}</div>
        </div>
      </div>
    </div>
  </>);
}

function Chart({ points, fmt }: { points: { zone_code: string; date: string; ndvi: number }[]; fmt: (iso: string) => string }) {
  const t = useT();
  const zones = [...new Set(points.map((p) => p.zone_code))].sort();
  const tm = (d: string) => new Date(d + "T12:00:00").getTime();
  const t0 = Math.min(...points.map((p) => tm(p.date))), t1 = Math.max(...points.map((p) => tm(p.date)));
  const ymin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.ndvi)) - 0.05) * 10) / 10), ymax = 1;
  const W = 520, H = 270, L = 40, R = 16, T = 14, B = 38;
  const X = (ms: number) => L + (t1 === t0 ? 0.5 : (ms - t0) / (t1 - t0)) * (W - L - R), Y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const step = ymax - ymin > 0.55 ? 0.2 : 0.1, grid: number[] = [];
  for (let v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) grid.push(v);
  const dates = [...new Set(points.map((p) => p.date))].sort(); let lastX = -999; const labels: string[] = [];
  dates.forEach((d, i) => { const x = X(tm(d)); if (x - lastX >= 62 && (i === 0 || W - R - x >= 20 || i === dates.length - 1)) { labels.push(d); lastX = x; } });
  const latest = zones.map((z) => { const zp = points.filter((p) => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date)); return { z, v: zp[zp.length - 1].ndvi }; });
  const low = latest.reduce((a, b) => (b.v < a.v ? b : a)), others = latest.filter((x) => x.z !== low.z);
  const gap = others.length ? others.reduce((a, b) => a + b.v, 0) / others.length - low.v : 0;
  return (<>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("vigorOverTime")} style={{ direction: "ltr" }} className="mt-2">
      {grid.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="currentColor" strokeOpacity=".12" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="13" fill="currentColor" opacity=".7">{v.toFixed(1)}</text></g>)}
      {0.7 > ymin && <line x1={L} x2={W - R} y1={Y(0.7)} y2={Y(0.7)} stroke="#E9A23B" strokeDasharray="5 4" />}
      {labels.map((d) => <text key={d} x={X(tm(d))} y={H - 14} textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">{fmt(d)}</text>)}
      {zones.map((z) => { const zp = points.filter((p) => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date)); const last = zp[zp.length - 1]; return (
        <g key={z}><polyline fill="none" stroke={ZCOL[z]} strokeWidth="2.5" strokeLinejoin="round" points={zp.map((p) => `${X(tm(p.date)).toFixed(1)},${Y(p.ndvi).toFixed(1)}`).join(" ")} />
          {zp.map((p) => <circle key={p.date} cx={X(tm(p.date))} cy={Y(p.ndvi)} r="3.5" fill={ZCOL[z]}><title>{z}, {fmt(p.date)}: {p.ndvi.toFixed(2)}</title></circle>)}
          <text x={X(tm(last.date)) + 7} y={Y(last.ndvi) + 4} fontSize="13" fontWeight="700" fill={ZCOL[z]}>{z}</text></g>); })}
    </svg>
    {gap > 0.05 && <div className="sub mt-1.5"><b>{t("lowest", { z: low.z, v: low.v.toFixed(2) })}</b></div>}
  </>);
}
