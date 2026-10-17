"use client";

// Everything the farmer does that the server must hear about (answers to tasks, activities) waits here first, on the phone,
// and is sent in order through `POST /sync` as soon as the server can be reached. The phone is never blocked by the server.
import { API, post, unreachable } from "./api";

export type Action = { type: string; payload: Record<string, unknown> };
const KEY = "growmate-queue";

const read = (): Action[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const listeners = new Set<() => void>();
const write = (q: Action[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage full: the action is lost, the screen already shows it */ } listeners.forEach((f) => f()); };

/** How many answers wait on the phone to be sent, and a way to hear when that changes (for the "saved on your phone" banner). */
export const pendingCount = () => read().length;
export function onQueueChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

export function enqueue(...actions: Action[]) {
  write([...read(), ...actions]);
}

let sending: Promise<void> | null = null;
/** Send what is waiting. Safe to call often: one send at a time, and what arrived meanwhile stays for the next one. */
export function flush(): Promise<void> {
  if (!API) return Promise.resolve();
  if (sending) return sending;
  sending = (async () => {
    const batch = read();
    if (batch.length === 0) return;
    try {
      await post("/sync", { actions: batch });   // the server reports each action; one it refuses must not block the rest
      write(read().slice(batch.length));
    } catch (e) {
      if (!unreachable(e)) write(read().slice(batch.length));   // refused as a whole (bad data): do not retry forever
    }
  })().finally(() => { sending = null; });
  return sending;
}
