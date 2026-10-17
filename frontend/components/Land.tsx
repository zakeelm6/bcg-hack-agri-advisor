"use client";
// The land: the Sentinel-2 picture of the surroundings with the four zones, the value of the chosen layer, the task pins,
// the sensor dots and the satellite anomaly cells on top. Pins are links (keyboard reachable) of 44 px or more on a phone.
import Link from "next/link";
import { useState } from "react";
import { API, type AnomaliesOut, type StateOut, type ZoneOut } from "@/lib/api";
import { useFarm, useT } from "@/lib/farm";
import { Ic, ICONS, Tag, taskIcon } from "./legacy-ui";

export type Layer = "vigor" | "moisture" | "soil" | "trust";
const ND = { low: "#D9A64C", mid: "#9CCC6B", high: "#4C8A3A" };
const LAYERS: { id: Layer; icon: string; key: "layerVigor" | "layerMoisture" | "layerSoil" | "layerTrust" }[] = [
  { id: "vigor", icon: "leaf", key: "layerVigor" }, { id: "moisture", icon: "drop", key: "layerMoisture" }, { id: "soil", icon: "flask", key: "layerSoil" }, { id: "trust", icon: "shield", key: "layerTrust" },
];

function color(z: ZoneOut, layer: Layer) {
  if (layer === "vigor") return z.ndvi < 0.45 ? ND.low : z.ndvi < 0.65 ? ND.mid : ND.high;
  if (layer === "moisture") return z.moisture == null ? "#bbb" : z.moisture < 0.23 ? ND.low : z.moisture < 0.28 ? ND.mid : "#3A8F85";
  if (layer === "trust") return z.confidence === "High" ? ND.high : z.confidence === "Medium" ? ND.mid : ND.low;
  const st = z.soil_test as { ph?: number | null } | null;
  if (!st || st.ph == null) return "#CDB88E";
  return st.ph >= 5.5 && st.ph <= 7.5 ? ND.high : ND.low;
}

export function LandSvg({ s, layer, land, anomalies, margin = 32 }: { s: StateOut; layer: Layer; land: { date: string } | null | undefined; anomalies: AnomaliesOut | null | undefined; margin?: number }) {
  const t = useT();
  const F = 155, fx = 240 - F / 2, fy = 240 - F / 2, w = F / 2, r = 7.5, fs = 7, pr = w * 0.21;
  const vb = `${fx - margin} ${fy - margin} ${F + 2 * margin} ${F + 2 * margin}`;
  const open = s.tasks.filter((x) => x.status === "open");
  const byZone: Record<string, typeof open> = {};
  open.forEach((x) => { (byZone[x.zone_code] ??= []).push(x); });
  const g = anomalies && anomalies.available ? anomalies : null;
  const grid = g?.grid as { rows: number; cols: number } | undefined;
  return (
    <svg viewBox={vb} width="100%" role="img" aria-label={t("fieldMap")} className="block w-full max-h-[62vh]" style={{ direction: "ltr" }}>
      {land ? <image href={`${API}/static/land.png?v=${land.date}`} x="0" y="0" width="480" height="480" preserveAspectRatio="none" /> : <rect x="0" y="0" width="480" height="480" fill="#B9D9BF" />}
      {s.zones.map((z) => {
        const x = fx + z.col * w, y = fy + z.row * w, st = z.soil_test as { ph?: number | null } | null;
        const val = layer === "vigor" ? z.ndvi.toFixed(2) : layer === "moisture" ? (z.moisture != null ? `${Math.round(z.moisture * 100)}%` : "?") : layer === "soil" && st?.ph != null ? `pH ${st.ph}` : "";
        const bad = z.sensor_quality === "low" || z.sensor_quality === "insufficient";
        return (
          <g key={z.code}>
            <rect x={x} y={y} width={w} height={w} fill={color(z, layer)} fillOpacity=".62" stroke="#fff" strokeWidth="1.4" />
            <text x={x + 4} y={y + fs + 2} fontSize={fs} fontWeight="700" fill="#fff" stroke="#1D2B1A" strokeWidth=".5" paintOrder="stroke">{z.code}</text>
            {val && <text x={x + w - 4} y={y + fs * 1.3 + 2} textAnchor="end" fontSize={fs * 1.3} fontWeight="700" fill="#fff" stroke="#1D2B1A" strokeWidth=".6" paintOrder="stroke">{val}</text>}
            {z.has_sensor && (
              <g><title>{t(bad ? "sensorBad" : "sensor")}</title>
                <circle cx={x + r + 1} cy={y + w - r - 1} r={r * 0.62} fill={bad ? "#B5472B" : "#fff"} stroke={bad ? "#fff" : "#22401F"} strokeWidth="1.2" />
                {bad ? <text x={x + r + 1} y={y + w - r - 1 + r * 0.3} textAnchor="middle" fontSize={r * 0.9} fontWeight="700" fill="#fff">!</text> : <circle cx={x + r + 1} cy={y + w - r - 1} r={r * 0.26} fill="#22401F" />}
              </g>
            )}
          </g>
        );
      })}
      {g && grid && g.features.map((f, i) => {
        const p = f.properties as { cells?: [number, number][]; zone_code?: string; why?: string };
        const cw = F / grid.cols, ch = F / grid.rows;
        return <g key={i} opacity=".8"><title>{p.zone_code}: {p.why}</title>{(p.cells ?? []).map(([rr, cc], j) => <rect key={j} x={fx + cc * cw} y={fy + rr * ch} width={cw} height={ch} fill="#B5472B" fillOpacity=".5" stroke="#fff" strokeOpacity=".5" strokeWidth=".4" />)}</g>;
      })}
      <rect x={fx} y={fy} width={F} height={F} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 4" />
      {s.zones.map((z) => {
        const list = (byZone[z.code] ?? []).slice(0, 3);
        const x = fx + z.col * w, y = fy + z.row * w, step = pr * 2.15, x0 = x + w / 2 - (list.length - 1) * step / 2, cy = y + w * 0.6;
        return list.map((task, i) => {
          const cx = x0 + i * step, k = pr * 1.2 / 24;
          return (
            <Link key={task.id} href={`/tasks/${task.id}`} className="group outline-none" aria-label={task.title}>
              <title>{task.title}</title>
              <circle cx={cx} cy={cy} r={pr} fill="#fff" stroke="#31572C" strokeWidth="1.6" className="group-hover:stroke-sun group-focus-visible:stroke-sun group-focus-visible:[stroke-width:3]" />
              <g transform={`translate(${cx - pr * 0.6} ${cy - pr * 0.6}) scale(${k})`} fill="none" stroke="#31572C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[taskIcon(task.type)] }} />
            </Link>
          );
        });
      })}
    </svg>
  );
}

export function LayerChips({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  const t = useT();
  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      {LAYERS.map((l) => (
        <button key={l.id} type="button" onClick={() => onChange(l.id)} aria-pressed={layer === l.id} aria-label={t(l.key)} title={t(l.key)}
          className={`inline-flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold ${layer === l.id ? "bg-leaf text-paper" : "bg-soft text-leaf"}`}>
          <Ic name={l.icon} size={20} />{layer === l.id && <span>{t(l.key)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Legend({ s, layer, anomalies }: { s: StateOut; layer: Layer; anomalies: AnomaliesOut | null | undefined }) {
  const t = useT();
  const bad = s.sensors.some((x) => x.quality === "low" || x.quality === "insufficient");
  const sensorBits = (<>
    {s.sensors.length > 0 && <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full border-2 border-[#22401F] bg-white" />{t("sensor")}</span>}
    {bad && <span className="inline-flex items-center gap-1"><i className="grid h-3 w-3 place-items-center rounded-full bg-[#B5472B] text-[8px] font-bold not-italic text-white">!</i>{t("sensorBad")}</span>}
    {anomalies?.available && anomalies.features.length > 0 && <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 border border-white bg-[#B5472B]/60" />{t("satAlert")}</span>}
  </>);
  if (layer === "soil") return (
    <div className="mx-1 mt-2.5 flex flex-wrap gap-3 text-xs text-muted">
      <span><i className="me-1 inline-block h-3.5 w-3.5 rounded" style={{ background: ND.high }} />{t("phOk")}</span>
      <span><i className="me-1 inline-block h-3.5 w-3.5 rounded" style={{ background: ND.low }} />{t("phOut")}</span>
      <span><i className="me-1 inline-block h-3.5 w-3.5 rounded bg-[#CDB88E]" />{t("noTest")}</span>{sensorBits}
    </div>
  );
  return (
    <div className="mx-1 mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>{t("low")}</span>
      <div className="h-2.5 min-w-20 flex-1 rounded-full rtl:scale-x-[-1]" style={{ background: layer === "moisture" ? "linear-gradient(90deg,#D9A64C,#9CCC6B,#3A8F85)" : "linear-gradient(90deg,#D9A64C,#9CCC6B,#4C8A3A)" }} role="img" aria-label={`${t("low")} - ${t("high")}`} />
      <span>{t("high")}</span>{sensorBits}
    </div>
  );
}

/** Honest labels: where the picture, the vigor and the anomalies come from, and that the sensors are simulated. */
export function LandNote({ s, land, anomalies }: { s: StateOut; land: { date: string } | null | undefined; anomalies: AnomaliesOut | null | undefined }) {
  const t = useT();
  const { lang } = useFarm();
  const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString((lang === "ar" || lang === "ary") ? "ar-MA-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  const m = /sentinel-2 (\d{4}-\d{2}-\d{2})/.exec(s.zones[0]?.ndvi_source ?? "");
  return (
    <div className="mt-1 flex flex-wrap text-xs text-muted">
      {land && <Tag>{t("picFrom", { d: fmt(land.date) })}</Tag>}
      {m ? <Tag>{t("vigorFrom", { d: fmt(m[1]) })}</Tag> : <Tag warn>{t("vigorSim")}</Tag>}
      {anomalies?.available && <Tag>{t("anomFrom", { n: anomalies.dates })}</Tag>}
      {(s.data_notes as { sensors?: string }).sensors === "simulated" && <Tag warn>{t("sensorsSim")}</Tag>}
    </div>
  );
}

export function LandCard({ s, land, anomalies, margin, title }: { s: StateOut; land: { date: string } | null | undefined; anomalies: AnomaliesOut | null | undefined; margin?: number; title?: React.ReactNode }) {
  const [layer, setLayer] = useState<Layer>("vigor");
  return (
    <div className="card">
      {title}
      <LayerChips layer={layer} onChange={setLayer} />
      <div className="overflow-hidden rounded-2xl bg-soft leading-none"><LandSvg s={s} layer={layer} land={land} anomalies={anomalies} margin={margin} /></div>
      <Legend s={s} layer={layer} anomalies={anomalies} />
      <LandNote s={s} land={land} anomalies={anomalies} />
    </div>
  );
}
