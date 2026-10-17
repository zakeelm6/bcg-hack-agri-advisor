// Typed client for the frozen API (types generated from backend/openapi.json with openapi-typescript).
// Reads are cached in localStorage so the app opens offline; writes go into a queue replayed through /api/sync.
// Numbers are never computed here: the app displays what the server returns.
import type { components } from "./api-types";

export type StateOut = components["schemas"]["StateOut"];
export type ZoneOut = components["schemas"]["ZoneOut"];
export type TaskOut = components["schemas"]["TaskOut"];
export type AlertOut = components["schemas"]["AlertOut"];
export type SensorOut = components["schemas"]["SensorOut"];
export type ForecastOut = components["schemas"]["ForecastOut"];
export type OffersOut = components["schemas"]["OffersOut"];
export type NdviSeriesOut = components["schemas"]["NdviSeriesOut"];
export type CopilotOut = components["schemas"]["CopilotOut"];
export type CopilotStatusOut = components["schemas"]["CopilotStatusOut"];
export type SpeechStatusOut = components["schemas"]["SpeechStatusOut"];
export type AnomaliesOut = components["schemas"]["AnomaliesOut"];
export type VisionOut = components["schemas"]["VisionOut"];
export type SyncResult = components["schemas"]["SyncOut"];

export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const lsGet = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
};
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full: keep running */ } };

/** Online state shared by the whole app (set by fetch results and the browser events). */
export const net = {
  offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  listeners: new Set<() => void>(),
  set(v: boolean) { if (this.offline !== v) { this.offline = v; this.listeners.forEach((l) => l()); } },
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; },
};

export async function fetchJson<T>(path: string, init: RequestInit = {}, ms = 7000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(API + path, { ...init, signal: ctl.signal });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return (await r.json()) as T;
  } finally { clearTimeout(t); }
}

/** GET with a local copy: online it refreshes the copy, offline it returns the copy (or null). */
export async function cachedGet<T>(path: string): Promise<{ data: T | null; fromCache: boolean }> {
  try {
    const j = await fetchJson<T>(path);
    lsSet("c:" + path, { t: Date.now(), j });
    net.set(false);
    return { data: j, fromCache: false };
  } catch {
    net.set(true);
    const c = lsGet<{ t: number; j: T } | null>("c:" + path, null);
    return { data: c ? c.j : null, fromCache: true };
  }
}
export const readCache = <T,>(path: string): T | null => lsGet<{ t: number; j: T } | null>("c:" + path, null)?.j ?? null;
export const writeCache = (path: string, j: unknown) => lsSet("c:" + path, { t: Date.now(), j });

// ---------------------------------------------------------------- offline queue

export type QueuedAction =
  | { type: "task_status"; payload: { task_id: number; status: "open" | "done" | "skipped" } }
  | { type: "observation"; payload: { task_id?: number | null; result?: string | null; note?: string | null; photo?: string | null; yield_kg?: number | null } }
  | { type: "soil_test"; payload: { zone_code: string; ph?: number | null; om_pct?: number | null; moisture?: number | null } }
  | { type: "listing"; payload: Record<string, never> }
  | { type: "offer_accept"; payload: { offer_id: number } };

export const getQueue = () => lsGet<(QueuedAction & { ts: number })[]>("fa_queue", []);
const setQueue = (q: (QueuedAction & { ts: number })[]) => lsSet("fa_queue", q);
export function enqueue(a: QueuedAction) { const q = getQueue(); q.push({ ...a, ts: Date.now() }); setQueue(q); }

let flushing = false;
/** Replays the queue through /api/sync. Returns {sent, failed} or null when the network is down or a flush is running. */
export async function flushQueue(): Promise<{ sent: number; failed: number } | null> {
  const q = getQueue();
  if (!q.length || flushing) return null;
  flushing = true;
  try {
    const j = await fetchJson<SyncResult>("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actions: q.map(({ type, payload }) => ({ type, payload })) }) }, 15000);
    const failed = j.results.filter((r) => !r.ok).length;
    setQueue([]);
    net.set(false);
    return { sent: q.length - failed, failed };
  } catch {
    net.set(true);
    return null;
  } finally { flushing = false; }
}

export const fmtNum = (locale: string, n: number, d = 0) => Number(n).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
