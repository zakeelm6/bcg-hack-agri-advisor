"use client";

// The farmer's field as the engine sees it: whose it is (the demo parcel or their own), the state of its satellite pictures,
// the vigor of each zone and the persistent problem spots. Kept on the phone for when there is no connection.
import { useCallback, useEffect, useState } from "react";
import { API, get, post } from "./api";
import type { Lang } from "./i18n";

export type FieldInfo = {
  source: "demo" | "own"; satellite_status: "ready" | "pending" | "failed" | "none"; satellite_note?: string | null;
  lat: number; lon: number; area_ha: number; side_m?: number | null;
  picture?: { date: string; side_m: number; field_side_m: number } | null;
};
export type Zone = { code: string; col: number; row: number; area_ha: number; ndvi: number | null; ndvi_source: string; moisture: number | null; confidence: string; has_sensor: boolean };
export type Spot = { properties: { zone_code?: string; cells?: [number, number][]; severity?: string } };
export type ZonesData = { zones: Zone[]; spots: Spot[]; grid?: { rows: number; cols: number } };

const KEY = "growmate-field";
const read = <T,>(fallback: T): T => { try { return JSON.parse(localStorage.getItem(KEY) ?? "") as T; } catch { return fallback; } };
const keep = (v: unknown) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full */ } };

/** Vigor in three words and a colour; null when no satellite picture of the zone has been read. */
export const vigorLevel = (v: number | null | undefined) => (v == null ? "unknown" : v >= 0.65 ? "good" : v >= 0.45 ? "medium" : "weak") as "good" | "medium" | "weak" | "unknown";

export function useFieldView(lang: Lang) {
  const [info, setInfo] = useState<FieldInfo | null>(() => (typeof window === "undefined" ? null : read<{ info?: FieldInfo }>({}).info ?? null));
  const [data, setData] = useState<ZonesData | null>(() => (typeof window === "undefined" ? null : read<{ data?: ZonesData }>({}).data ?? null));
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!API) return;
    try {
      const [i, s, a] = await Promise.all([
        get<FieldInfo>("/field"),
        get<{ zones: Zone[] }>(`/state?lang=${lang}`),
        get<{ features: Spot[]; grid?: { rows: number; cols: number } }>(`/zones/anomalies?lang=${lang}`).catch(() => ({ features: [] as Spot[], grid: undefined })),
      ]);
      const d = { zones: s.zones, spots: a.features, grid: a.grid };
      setInfo(i); setData(d); setStale(false); keep({ info: i, data: d });
    } catch {
      setStale(true);   // offline: what we last saw stays on screen
    }
  }, [lang]);

  useEffect(() => { load(); window.addEventListener("online", load); return () => window.removeEventListener("online", load); }, [load]);
  useEffect(() => {   // a satellite download takes minutes: look again every 10 s while it runs
    if (info?.satellite_status !== "pending") return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [info?.satellite_status, load]);

  const retry = useCallback(async () => {
    try { setInfo(await post<FieldInfo>("/field/satellite", {})); } catch { /* still offline */ }
  }, []);

  return { info, data, stale, retry, reload: load };
}
