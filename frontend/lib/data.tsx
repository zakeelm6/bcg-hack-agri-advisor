"use client";
// Data layer: TanStack Query over the typed client, with the local copy as the offline fallback and
// optimistic updates for the queued writes. Components never compute a number: they show what the server returned.
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { cachedGet, enqueue, flushQueue, getQueue, net, readCache, writeCache, type AnomaliesOut, type ForecastOut, type NdviSeriesOut, type OffersOut, type QueuedAction, type StateOut } from "./api";
import { useFarm } from "./farm";
import type { Lang } from "./i18n";

const client = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 60_000, refetchOnWindowFocus: false } } });
export function DataProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** true when the last request failed or the browser says it is offline */
export function useOffline() {
  return useSyncExternalStore((cb) => net.subscribe(cb), () => net.offline, () => false);
}

function useCached<T>(key: string, path: string, enabled = true) {
  return useQuery<T | null>({
    queryKey: [key, path],
    enabled,
    queryFn: async () => (await cachedGet<T>(path)).data,
    initialData: () => (typeof window === "undefined" ? undefined : readCache<T>(path) ?? undefined),
    placeholderData: (prev) => prev,
  });
}

export const stateKey = (lang: Lang) => `/api/state?lang=${lang}`;
export function useAppState() {
  const { lang } = useFarm();
  return useCached<StateOut>("state", stateKey(lang));
}
export const useForecast = () => { const { lang } = useFarm(); return useCached<ForecastOut>("forecast", `/api/forecast?lang=${lang}`); };
export const useOffers = () => useCached<OffersOut>("offers", "/api/offers");
export const useSeries = () => { const { lang } = useFarm(); return useCached<NdviSeriesOut>("series", `/api/ndvi-series?lang=${lang}`); };
export const useAnomalies = () => { const { lang } = useFarm(); return useCached<AnomaliesOut>("anomalies", `/api/zones/anomalies?lang=${lang}`); };
export function useLand() {
  return useQuery<{ date: string; px: number } | null>({ queryKey: ["land"], queryFn: async () => (await cachedGet<{ date: string; px: number }>("/static/land.json")).data, initialData: () => readCache("/static/land.json") ?? undefined });
}

/** Queue a write, apply it to the local state at once, then try to send. */
export function useActions() {
  const qc = useQueryClient();
  const { lang } = useFarm();
  const [, bump] = useState(0);

  const applyLocal = useCallback((a: QueuedAction) => {
    const path = stateKey(lang);
    const s = qc.getQueryData<StateOut | null>(["state", path]);
    if (s) {
      const next: StateOut = structuredClone(s);
      if (a.type === "task_status") { const t = next.tasks.find((x) => x.id === a.payload.task_id); if (t) t.status = a.payload.status; }
      if (a.type === "soil_test") {
        const rec = { zone_code: a.payload.zone_code, ph: a.payload.ph ?? null, om_pct: a.payload.om_pct ?? null, moisture: a.payload.moisture ?? null, age_days: 0, pending: true } as StateOut["soil_tests"][number] & { pending: boolean };
        next.soil_tests = next.soil_tests.filter((t) => t.zone_code !== a.payload.zone_code).concat(rec);
        const z = next.zones.find((x) => x.code === a.payload.zone_code); if (z) z.soil_test = rec;
      }
      qc.setQueryData(["state", path], next); writeCache(path, next);
    }
    if (a.type === "offer_accept") {
      const o = qc.getQueryData<OffersOut | null>(["offers", "/api/offers"]);
      if (o) { const n = structuredClone(o); n.offers.forEach((x) => { x.status = x.id === a.payload.offer_id ? "accepted" : "declined"; }); qc.setQueryData(["offers", "/api/offers"], n); writeCache("/api/offers", n); }
    }
    if (a.type === "listing") {
      const f = qc.getQueryData<ForecastOut | null>(["forecast", `/api/forecast?lang=${lang}`]);
      if (f) { const n = { ...f, listing: { status: "published" } }; qc.setQueryData(["forecast", `/api/forecast?lang=${lang}`], n); }
    }
  }, [qc, lang]);

  const flush = useCallback(async (): Promise<{ sent: number; failed: number } | null> => {
    const r = await flushQueue();
    if (r) await qc.invalidateQueries({ queryKey: ["state"] });
    bump((n) => n + 1);
    return r;
  }, [qc]);

  const act = useCallback((a: QueuedAction) => { enqueue(a); applyLocal(a); bump((n) => n + 1); void flush(); }, [applyLocal, flush]);

  useEffect(() => {
    const on = () => { net.set(false); void flush(); };
    const off = () => net.set(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [flush]);

  return { act, flush, queued: typeof window === "undefined" ? 0 : getQueue().length, refresh: () => qc.invalidateQueries() };
}

export const openTasks = (s: StateOut | null | undefined) => (s?.tasks ?? []).filter((t) => t.status === "open");
export const unreadCount = (s: StateOut | null | undefined) => (s?.alerts ?? []).filter((a) => a.unread).length;
