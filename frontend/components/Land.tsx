"use client";
// The land: the hero of the product. The Sentinel-2 picture of the surroundings with the four zones on top; the chosen layer
// colours the zones and writes one value per zone in a chip (bottom-start corner); task pins sit in the centre band and
// never cover a value; sensors sit top-end; the satellite anomaly cells are drawn on top. Tap a zone to see its line.
// Pins are links of 44 px or more on a phone. Everything else about the data is behind the "Data" disclosure.
import Link from "next/link";
import { useState } from "react";
import { API, type AnomaliesOut, type StateOut, type ZoneOut } from "@/lib/api";
import { useFarm, useT } from "@/lib/farm";
import { Badge, ConfidenceMeter, Icon, ICONS, Segmented, taskIcon } from "./ui";

export type Layer = "vigor" | "moisture" | "soil" | "trust";
export type LandMeta = { date: string; side_m: number; field_side_m: number };
const V = { low: "var(--color-vigor-low)", mid: "var(--color-vigor-mid)", high: "var(--color-vigor-high)", wet: "var(--color-moisture-high)", none: "#CDB88E", unknown: "#9A9A9A" };

function color(z: ZoneOut, layer: Layer) {
  if (layer === "vigor") return z.ndvi == null ? V.unknown : z.ndvi < 0.45 ? V.low : z.ndvi < 0.65 ? V.mid : V.high;
  if (layer === "moisture") return z.moisture == null ? V.unknown : z.moisture < 0.23 ? V.low : z.moisture < 0.28 ? V.mid : V.wet;
  if (layer === "trust") return z.confidence === "High" ? V.high : z.confidence === "Medium" ? V.mid : V.low;
  const st = z.soil_test as { ph?: number | null } | null;
  if (!st || st.ph == null) return V.none;
  return st.ph >= 5.5 && st.ph <= 7.5 ? V.high : V.low;
}
function value(z: ZoneOut, layer: Layer) {
  const st = z.soil_test as { ph?: number | null } | null;
  if (layer === "vigor") return z.ndvi == null ? "?" : z.ndvi.toFixed(2);
  if (layer === "moisture") return z.moisture != null ? `${Math.round(z.moisture * 100)}%` : "?";
  if (layer === "soil") return st?.ph != null ? `pH ${st.ph}` : "–";
  return z.confidence === "High" ? "●●●" : z.confidence === "Medium" ? "●●○" : "●○○";
}

export function LandSvg({ s, layer, land, anomalies, margin = 32, selected, onSelect }: { s: StateOut; layer: Layer; land: LandMeta | null | undefined; anomalies: AnomaliesOut | null | undefined; margin?: number; selected?: string | null; onSelect?: (code: string | null) => void }) {
  const t = useT();
  const F = land ? (480 * land.field_side_m) / land.side_m : 155, fx = 240 - F / 2, fy = 240 - F / 2, w = F / 2, fs = 7.5, pr = w * 0.2;
  const vb = `${fx - margin} ${fy - margin} ${F + 2 * margin} ${F + 2 * margin}`;
  const open = s.tasks.filter((x) => x.status === "open");
  const byZone: Record<string, typeof open> = {};
  open.forEach((x) => { (byZone[x.zone_code] ??= []).push(x); });
  const g = anomalies && anomalies.available ? anomalies : null;
  const grid = g?.grid as { rows: number; cols: number } | undefined;
  return (
    <svg viewBox={vb} width="100%" role="img" aria-label={t("fieldMap")} className="block w-full max-h-[62vh] select-none" style={{ direction: "ltr" }}>
      <defs><clipPath id="field-clip"><rect x={fx} y={fy} width={F} height={F} /></clipPath></defs>
      {land ? <image href={`${API}/api/field/picture?v=${land.date}`} x="0" y="0" width="480" height="480" preserveAspectRatio="none" /> : <rect x="0" y="0" width="480" height="480" fill="#B9D9BF" />}
      <rect x="0" y="0" width="480" height="480" fill="#0B1208" fillOpacity=".18" />
      {s.zones.map((z) => {
        const x = fx + z.col * w, y = fy + z.row * w, sel = selected === z.code;
        return (
          <g key={z.code} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-pressed={onSelect ? sel : undefined} aria-label={`${t("zone", { z: z.code })}: ${value(z, layer)}`}
            onClick={onSelect ? () => onSelect(sel ? null : z.code) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(sel ? null : z.code); } } : undefined} className={onSelect ? "cursor-pointer outline-none" : ""}>
            <rect x={x} y={y} width={w} height={w} fill={color(z, layer)} fillOpacity={sel ? ".55" : ".62"} stroke="#fff" strokeOpacity={sel ? 1 : .8} strokeWidth={sel ? 2.4 : 1} />
          </g>
        );
      })}
      {g && grid && g.features.map((f, i) => {
        const p = f.properties as { cells?: [number, number][]; zone_code?: string; why?: string };
        const cw = F / grid.cols, ch = F / grid.rows;
        return <g key={i} clipPath="url(#field-clip)"><title>{p.zone_code}: {p.why}</title>{(p.cells ?? []).map(([rr, cc], j) => <rect key={j} x={fx + cc * cw} y={fy + rr * ch} width={cw} height={ch} fill="var(--color-zone-d)" fillOpacity=".55" stroke="#fff" strokeOpacity=".35" strokeWidth=".3" />)}</g>;
      })}
      <rect x={fx} y={fy} width={F} height={F} fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="5 3" opacity=".9" />
      {s.zones.map((z) => {
        const x = fx + z.col * w, y = fy + z.row * w, val = value(z, layer), bad = z.sensor_quality === "low" || z.sensor_quality === "insufficient";
        const chipW = 10 + (z.code.length + val.length) * fs * 0.62 + 4, chipH = fs * 1.9;
        return (
          <g key={z.code} pointerEvents="none">
            <rect x={x + 3} y={y + w - chipH - 3} width={chipW} height={chipH} rx={chipH / 2} fill="#0F1A0C" fillOpacity=".72" />
            <text x={x + 3 + 6} y={y + w - 3 - chipH / 2 + fs * 0.36} fontSize={fs} fontWeight="700" fill="#F6F1E5" fontFamily="var(--font-geist), system-ui, sans-serif"><tspan opacity=".75">{z.code}</tspan><tspan dx="3">{val}</tspan></text>
            {z.has_sensor && (
              <g><title>{t(bad ? "sensorBad" : "sensor")}</title>
                <circle cx={x + w - 7} cy={y + 7} r={4.6} fill={bad ? "var(--color-zone-d)" : "#F6F1E5"} stroke={bad ? "#fff" : "#0F1A0C"} strokeWidth="1" />
                {bad ? <text x={x + w - 7} y={y + 9.6} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="system-ui">!</text> : <circle cx={x + w - 7} cy={y + 7} r={1.8} fill="#0F1A0C" />}
              </g>
            )}
          </g>
        );
      })}
      {s.zones.map((z) => {
        const list = (byZone[z.code] ?? []).slice(0, 3);
        const x = fx + z.col * w, y = fy + z.row * w, step = pr * 2.15, x0 = x + w / 2 - (list.length - 1) * step / 2, cy = y + w * 0.42;
        return list.map((task, i) => {
          const cx = x0 + i * step, k = pr * 1.15 / 24;
          return (
            <Link key={task.id} href={`/tasks/${task.id}`} className="group outline-none" aria-label={task.title}>
              <title>{task.title}</title>
              <circle cx={cx} cy={cy} r={pr + 1.5} fill="#0F1A0C" fillOpacity=".25" />
              <circle cx={cx} cy={cy} r={pr} fill="#F6F1E5" stroke="var(--color-green-700)" strokeWidth="1.4" className="group-hover:stroke-[var(--color-accent)] group-focus-visible:stroke-[var(--color-accent)] group-focus-visible:[stroke-width:3]" />
              <g transform={`translate(${cx - pr * 0.575} ${cy - pr * 0.575}) scale(${k})`} fill="none" stroke="var(--color-green-700)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[taskIcon(task.type)] }} />
            </Link>
          );
        });
      })}
    </svg>
  );
}

export function LayerSwitch({ layer, onChange }: { layer: Layer; onChange: (l: Layer) => void }) {
  const t = useT();
  return <Segmented<Layer> label={t("fieldMap")} size="sm" value={layer} onChange={onChange} grow options={[{ id: "vigor", label: t("layerVigor"), icon: "leaf" }, { id: "moisture", label: t("layerMoisture"), icon: "drop" }, { id: "soil", label: t("layerSoil"), icon: "flask" }, { id: "trust", label: t("layerTrust"), icon: "shield" }]} />;
}

function Legend({ s, layer, anomalies }: { s: StateOut; layer: Layer; anomalies: AnomaliesOut | null | undefined }) {
  const t = useT();
  const bad = s.sensors.some((x) => x.quality === "low" || x.quality === "insufficient");
  const bar = layer === "moisture" ? "linear-gradient(90deg,var(--color-vigor-low),var(--color-vigor-mid),var(--color-moisture-high))" : "linear-gradient(90deg,var(--color-vigor-low),var(--color-vigor-mid),var(--color-vigor-high))";
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-text-2">
      {layer === "soil" ? (<>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: V.high }} />{t("phOk")}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: V.low }} />{t("phOut")}</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: V.none }} />{t("noTest")}</span>
      </>) : (<>
        <span>{t("low")}</span><i className="h-2 min-w-16 flex-1 rounded-full rtl:-scale-x-100" style={{ background: bar }} aria-hidden /><span>{t("high")}</span>
      </>)}
      {s.sensors.length > 0 && <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-white" />{t("sensor")}</span>}
      {bad && <span className="inline-flex items-center gap-1 text-danger"><Icon name="warning" size={13} />{t("sensorBad")}</span>}
      {anomalies?.available && anomalies.features.length > 0 && <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--color-zone-d)]/70" />{t("satAlert")}</span>}
    </div>
  );
}

/** Honest labels, behind one disclosure: where the picture, the vigor and the anomalies come from; that the sensors are simulated. */
function DataSources({ s, land, anomalies }: { s: StateOut; land: LandMeta | null | undefined; anomalies: AnomaliesOut | null | undefined }) {
  const t = useT();
  const { lang } = useFarm();
  const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(lang === "ar" || lang === "ary" ? "ar-MA-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  const m = /sentinel-2 (\d{4}-\d{2}-\d{2})/.exec(s.zones[0]?.ndvi_source ?? "");
  const sim = (s.data_notes as { sensors?: string }).sensors === "simulated";
  return (
    <details className="mt-1 border-t-0">
      <summary className="text-sm text-text-2">{t("dataSources")}</summary>
      <div className="flex flex-wrap gap-1.5 pb-2">
        {land && <Badge icon="satellite">{t("picFrom", { d: fmt(land.date) })}</Badge>}
        {m ? <Badge icon="leaf">{t("vigorFrom", { d: fmt(m[1]) })}</Badge> : <Badge tone="simulated" icon="leaf">{t("vigorSim")}</Badge>}
        {anomalies?.available && <Badge icon="search">{t("anomFrom", { n: anomalies.dates })}</Badge>}
        {sim && <Badge tone="simulated" icon="sensor">{t("sensorsSim")}</Badge>}
      </div>
    </details>
  );
}

function ZoneLine({ z, layer }: { z: ZoneOut; layer: Layer }) {
  const t = useT();
  const open = z;
  return (
    <div className="anim-fade-up mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <b className="font-display text-base">{t("zone", { z: open.code })}</b>
      <span className="num">{t("layerVigor")} {open.ndvi == null ? "?" : open.ndvi.toFixed(2)}</span>
      <span className="num">{t("layerMoisture")} {open.moisture != null ? `${Math.round(open.moisture * 100)}%` : "?"}</span>
      <ConfidenceMeter conf={open.confidence} size="sm" />
      <span className="basis-full text-xs text-text-2">{open.conf_reason}</span>
      {layer === "trust" && open.offset && <span className="basis-full text-xs text-text-3">{t("offsetNote", { s: (open.offset as { sentinel: string }).sentinel, n: (open.offset as { n: number }).n })}</span>}
    </div>
  );
}

export function LandCard({ s, land, anomalies, margin, title, compact }: { s: StateOut; land: LandMeta | null | undefined; anomalies: AnomaliesOut | null | undefined; margin?: number; title?: React.ReactNode; compact?: boolean }) {
  const [layer, setLayer] = useState<Layer>("vigor");
  const [selected, setSelected] = useState<string | null>(null);
  const z = selected ? s.zones.find((x) => x.code === selected) : null;
  return (
    <section className="rounded-xl border border-line bg-surface p-3 md:p-4">
      {title}
      <div className="mb-2.5"><LayerSwitch layer={layer} onChange={setLayer} /></div>
      <div className="overflow-hidden rounded-lg bg-neutral-900 leading-none"><LandSvg s={s} layer={layer} land={land} anomalies={anomalies} margin={margin} selected={selected} onSelect={setSelected} /></div>
      {z && <ZoneLine z={z} layer={layer} />}
      <Legend s={s} layer={layer} anomalies={anomalies} />
      {!compact && <DataSources s={s} land={land} anomalies={anomalies} />}
    </section>
  );
}
