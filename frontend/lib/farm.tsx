"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API, post, unreachable } from "./api";
import { enqueue, flush } from "./queue";
import { tr, tx, type Key, type Lang, type Text } from "./i18n";

export type Challenge = "water" | "crop health" | "costs" | "yield";
export type Profile = {
  location: string;
  crop: string;
  plantedOn: string;
  area: string;
  irrigation: string;
  challenge: Challenge | "";
  lat?: number; // from "Use my location"; weather uses these over the town name
  lon?: number;
  boundary?: [number, number][]; // field corners [lat, lng], drawn on the Measure map
};
export type Task = { id: string; title: Text; due: string; done: boolean };
export type ActivityType = "irrigation" | "treatment" | "planting" | "expense" | "other";
export type Activity = { id: string; type: ActivityType; date: string; note: string; cost?: number; zone?: string; mm?: number }; // zone: only that part of the field (none = all of it); mm: water applied
export type Advice = { recommendation: Text; why: Text; steps: Text[]; missing: Text[]; icons?: string[]; local?: boolean }; // icons[i] pictures steps[i]
// What the engine did with the profile the last time it was sent. `pending`: still to send (offline, server down).
export type ProfileSync = { pending: boolean; applied?: Record<string, unknown>; notApplied?: string[] };
export type Message =
  | { id: string; role: "user"; text: string; photo?: string }
  | { id: string; role: "ai"; text?: string; advice?: Advice };

type State = { lang: Lang; profile: Profile | null; sync?: ProfileSync; activitiesSent?: boolean; tasks: Task[]; activities: Activity[]; messages: Message[] };
const empty: State = { lang: "en", profile: null, tasks: [], activities: [], messages: [] };
const browserLang = (): Lang => (["ar", "fr"] as const).find((l) => navigator.language.startsWith(l)) ?? "en";
const KEY = "growmate";

export const uid = () => crypto.randomUUID();
const activityAction = (a: Activity) => ({
  type: "activity",
  payload: { client_id: a.id, type: a.type, date: a.date, note: a.note.slice(0, 200), cost: a.cost ?? null, zone: a.zone ?? null, amount_mm: a.mm ?? null },
});
export const today = () => new Date().toISOString().slice(0, 10);
export const daysSince = (d: string) => Math.floor((Date.parse(today()) - Date.parse(d)) / 864e5);

// Local first: the phone keeps the farmer's profile, tasks, activities and chat in localStorage. The profile is also sent to the
// backend (`POST /farmer`) so the engine works with the crop, planting date and area; if the server cannot be reached it is sent later.
// Tasks, activities and chat are not sent yet.
function useFarmState() {
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    try {
      const saved = { ...empty, lang: browserLang(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") } as State;
      // A profile saved before the backend existed has never reached the engine: send it once.
      const first = !!API && !saved.activitiesSent;   // activities written before the backend existed are sent once
      if (first) { enqueue(...saved.activities.map(activityAction)); flush(); }
      setState({ ...(saved.profile && !saved.sync && API ? { ...saved, sync: { pending: true } } : saved), ...(API ? { activitiesSent: true } : {}) });
    } catch {
      setState(empty);
    }
  }, []);
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Quota full (mostly photos): drop old chat photos, keep farm records.
      const msgs = state.messages.map((m) => (m.role === "user" ? { ...m, photo: undefined } : m));
      localStorage.setItem(KEY, JSON.stringify({ ...state, messages: msgs }));
    }
  }, [state]);

  // Send the profile to the engine when it changed (or when the connection is back).
  useEffect(() => {
    flush();   // anything left from the last visit
    const online = () => { setRetry((n) => n + 1); flush(); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  useEffect(() => {
    if (!API || !state?.profile || !state.sync?.pending) return;
    const p = state.profile;
    post<{ applied?: Record<string, unknown>; not_applied?: string[] }>("/farmer", {
      location: p.location || null,
      crop: p.crop || null,
      planted_on: p.plantedOn || null,
      area_ha: parseFloat(p.area) > 0 ? parseFloat(p.area) : null,
      irrigation: p.irrigation || null,
      challenge: p.challenge || null,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      boundary: p.boundary ?? null,   // the corners the farmer drew: the engine centres its field on them
      lang: state.lang,
    }).then(
      (r) => setState((prev) => (prev && prev.profile === p ? { ...prev, sync: { pending: false, applied: r.applied ?? {}, notApplied: r.not_applied ?? [] } } : prev)),
      (e) => { if (!unreachable(e)) setState((prev) => (prev && prev.profile === p ? { ...prev, sync: { pending: false, applied: {}, notApplied: [] } } : prev)); }, // refused by the server: do not loop
    );
  }, [state?.profile, state?.sync?.pending, state?.lang, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = state ?? empty;
  const set = (patch: Partial<State>) => setState((prev) => ({ ...(prev ?? empty), ...patch }));
  return {
    ready: state !== null,
    ...s,
    setLang: (lang: Lang) => set({ lang }),
    saveProfile: (profile: Profile) => set({ profile, sync: { pending: !!API } }),
    addTask: (title: Text, due: string) => set({ tasks: [{ id: uid(), title, due, done: false }, ...s.tasks] }),
    toggleTask: (id: string) => set({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
    logActivity: (a: Omit<Activity, "id">) => {
      const id = uid();
      set({ activities: [{ ...a, id }, ...s.activities].sort((x, y) => y.date.localeCompare(x.date)) });
      enqueue(activityAction({ ...a, id })); flush(); // the engine learns from it (recorded watering, spending) when the server can be reached
      return id; // lets the UI offer Undo
    },
    removeActivity: (id: string) => {
      set({ activities: s.activities.filter((a) => a.id !== id) });
      enqueue({ type: "activity_remove", payload: { client_id: id } }); flush();
    },
    addMessages: (...m: Message[]) => setState((prev) => ({ ...(prev ?? empty), messages: [...(prev ?? empty).messages, ...m] })),
    clearMessages: () => set({ messages: [] }),
    reset: () => setState(empty),
  };
}

export type Farm = ReturnType<typeof useFarmState>;
const Ctx = createContext<Farm | null>(null);
export function FarmProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useFarmState()}>{children}</Ctx.Provider>;
}
export const useFarm = () => useContext(Ctx)!;
export function useT() {
  const { lang } = useFarm();
  return (key: Key, vars?: Record<string, string | number>) => tr(lang, key, vars);
}
export function useTx() {
  const { lang } = useFarm();
  return (x: Text) => tx(lang, x);
}
