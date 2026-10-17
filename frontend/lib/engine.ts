"use client";

// The engine's advice for the farmer's field: `GET /state` (tasks with when, why, cost, confidence, plan B), kept on the phone so it
// still shows without a connection, and the farmer's answers to it (done, can't do it and why) sent through `POST /sync`.
// An answer given offline waits in a small queue on the phone and is sent when the connection is back, in order.
import { useCallback, useEffect, useRef, useState } from "react";
import { API, get, post, unreachable } from "./api";
import type { Lang } from "./i18n";

export type EngineTask = {
  id: number; key: string; type: string; zone_code: string;
  title: string; what: string; when_text: string; when_date: string;
  why: string; cost: string; confidence: "High" | "Medium" | "Low"; conf_reason: string; plan_b: string;
  status: "open" | "done" | "skipped";
};
export type EngineState = { tasks: EngineTask[]; data_notes: { vigor: string; sensors: string }; generated_at: string };
type Action = { type: "task_status"; payload: { task_id: number; status: EngineTask["status"] } } | { type: "observation"; payload: { task_id: number; result: string; note: string } };

const CACHE = "growmate-engine";
const QUEUE = "growmate-queue";
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full: the advice is simply not cached */ } };

const ORDER: Record<string, number> = { irrigate: 0, fertilize: 1, inspect: 2 };
/** Open tasks first, the most urgent on top: earliest day, then water before fertilizer before a visit. */
export const openTasks = (tasks: EngineTask[]) =>
  tasks.filter((x) => x.status === "open").sort((a, b) => a.when_date.localeCompare(b.when_date) || (ORDER[a.type] ?? 9) - (ORDER[b.type] ?? 9));

export function useEngine(lang: Lang) {
  const [state, setState] = useState<EngineState | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(!!API);
  const busy = useRef(false);

  const flush = useCallback(async () => {
    const queue = read<Action[]>(QUEUE, []);
    if (!API || queue.length === 0) return;
    try {
      await post("/sync", { actions: queue });   // the server reports each action; one it refuses (task replaced since) must not block the rest
      write(QUEUE, []);
    } catch (e) {
      if (!unreachable(e)) write(QUEUE, []);     // refused as a whole (bad data): do not retry forever
    }
  }, []);

  const load = useCallback(async () => {
    if (!API || busy.current) return;
    busy.current = true;
    try {
      await flush();
      const s = await get<EngineState>(`/state?lang=${lang}`);
      setState(s); setStale(false); write(CACHE, { lang, state: s });
    } catch {
      const cached = read<{ state: EngineState } | null>(CACHE, null);   // offline: show the last advice we have, and say so
      if (cached) { setState(cached.state); setStale(true); }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [lang, flush]);

  useEffect(() => {
    load();
    window.addEventListener("online", load);
    return () => window.removeEventListener("online", load);
  }, [load]);

  /** Answer a task. The screen changes at once; the server hears about it now or when the connection is back. */
  const answer = useCallback(async (task: EngineTask, status: EngineTask["status"], reason?: string) => {
    setState((s) => (s ? { ...s, tasks: s.tasks.map((x) => (x.id === task.id ? { ...x, status } : x)) } : s));
    const queue = read<Action[]>(QUEUE, []);
    queue.push({ type: "task_status", payload: { task_id: task.id, status } });
    if (status === "skipped" && reason) queue.push({ type: "observation", payload: { task_id: task.id, result: "skipped", note: reason } });
    write(QUEUE, queue);
    write(CACHE, { lang, state: { ...(state as EngineState), tasks: (state?.tasks ?? []).map((x) => (x.id === task.id ? { ...x, status } : x)) } });
    await flush();
  }, [flush, lang, state]);

  return { state, stale, loading, answer, reload: load };
}
