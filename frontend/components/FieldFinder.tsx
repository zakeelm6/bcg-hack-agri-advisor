"use client";
// Find your field: GPS position, walk the edge (outline and area measured by the phone's GPS), or a village name.
// Ported from the legacy About page. The demo field stays where its satellite data is; this card says so.
import { useState } from "react";
import type { StateOut } from "@/lib/api";
import { useT } from "@/lib/farm";
import { Button, Icon } from "./ui";

type Pt = { lat: number; lon: number; acc: number };
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => { const R = 6371, r = (x: number) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const areaHa = (pts: Pt[]) => { if (pts.length < 3) return 0; const lat0 = (pts[0].lat * Math.PI) / 180, mx = 111320 * Math.cos(lat0), my = 110540; const xy = pts.map((p) => [(p.lon - pts[0].lon) * mx, (p.lat - pts[0].lat) * my]); let a = 0; for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2) / 10000; };

export function FieldFinder({ field }: { field: StateOut["field"] }) {
  const t = useT();
  const [opt, setOpt] = useState<"gps" | "walk" | "search">("gps");
  const [loc, setLoc] = useState<Pt | null>(null);
  const [msg, setMsg] = useState("");
  const [walking, setWalking] = useState<Pt[] | null>(null);
  const [watch, setWatch] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [qMsg, setQMsg] = useState("");

  const locate = () => {
    if (!navigator.geolocation) return setMsg(t("noGps"));
    setMsg(t("lookingPos"));
    navigator.geolocation.getCurrentPosition((p) => { setLoc({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); setMsg(""); },
      (err) => setMsg(err.code === 1 ? t("locBlocked") : t("noFix")), { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
  };
  const walkStart = () => {
    if (!navigator.geolocation) return setMsg(t("noGps"));
    setWalking([]); setMsg("");
    const id = navigator.geolocation.watchPosition((p) => {
      const pt = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      setWalking((w) => { const last = w?.[w.length - 1]; return !last || km(last, pt) * 1000 > 5 ? [...(w ?? []), pt] : w; });
    }, () => { setMsg(t("noSignal")); walkStop(true); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    setWatch(id);
  };
  const walkStop = (silent = false) => {
    if (watch != null) navigator.geolocation.clearWatch(watch);
    const pts = walking ?? []; setWalking(null); setWatch(null);
    if (silent) return;
    if (pts.length < 3) setMsg(t("walkMore"));
    else { try { localStorage.setItem("fa_outline", JSON.stringify(pts)); } catch { /* full */ } setMsg(t("outlineSaved", { n: pts.length, ha: areaHa(pts).toFixed(2) })); }
  };
  // the full external URL is not under API: fetchJson prefixes API, so use fetch directly for Nominatim
  const searchDirect = async () => {
    if (!q.trim()) return setQMsg(t("typeNameFirst"));
    setQMsg(t("searching"));
    try { const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q + ", Morocco")); const j = (await r.json()) as { display_name: string }[]; setQMsg(j[0] ? t("found", { p: j[0].display_name.split(",").slice(0, 3).join(",") }) : t("notFound")); }
    catch { setQMsg(t("noNetRetry")); }
  };

  const Opt = ({ id, icon, label, children }: { id: typeof opt; icon: string; label: string; children: React.ReactNode }) => (
    <div className={`rounded-xl border bg-surface transition-colors ${opt === id ? "border-brand" : "border-line"}`}>
      <button type="button" onClick={() => setOpt(id)} aria-expanded={opt === id} className="pressable flex min-h-14 w-full items-center gap-3 px-4 text-start">
        <span className={`grid h-10 w-10 flex-none place-items-center rounded-full ${opt === id ? "bg-brand-strong text-on-brand" : "bg-surface-2 text-brand"}`}><Icon name={icon} size={22} /></span>
        <span className="flex-1 text-base font-semibold">{label}</span><Icon name="chevdown" size={18} className={`text-text-3 transition-transform ${opt === id ? "rotate-180" : ""}`} />
      </button>
      {opt === id && <div className="anim-fade-up px-4 pb-4">{children}</div>}
    </div>
  );
  return (
    <div className="space-y-2">
      <Opt id="gps" icon="pin" label={t("useMyLocation")}>
        {loc ? <p className="text-sm text-text-2">{t("located", { lat: loc.lat.toFixed(4), lon: loc.lon.toFixed(4), m: Math.round(loc.acc), km: km(loc, field).toFixed(0) })}</p>
          : <><p className="text-sm text-text-2">{msg || t("gpsNoNet")}</p><Button size="sm" variant="secondary" icon="pin" className="mt-2.5" onClick={locate}>{t("findPosition")}</Button></>}
      </Opt>
      <Opt id="walk" icon="walk" label={t("walkEdge")}>
        {walking ? <><p className="text-sm text-text-2">{t("recordingPts", { n: walking.length })}</p><Button size="sm" variant="primary" icon="stop" className="mt-2.5" onClick={() => walkStop()}>{t("stopSave")}</Button></>
          : <><p className="text-sm text-text-2">{msg || t("walkHelp")}</p><Button size="sm" variant="secondary" icon="walk" className="mt-2.5" onClick={walkStart}>{t("startWalking")}</Button></>}
      </Opt>
      <Opt id="search" icon="search" label={t("villageName")}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("villageName")} aria-label={t("villageName")} className="mb-2 min-h-12 w-full rounded-lg border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" />
        <p className="text-sm text-text-2">{qMsg || t("needsNet")}</p>
        <Button size="sm" variant="secondary" icon="search" className="mt-2.5" onClick={searchDirect}>{t("search")}</Button>
      </Opt>
    </div>
  );
}
