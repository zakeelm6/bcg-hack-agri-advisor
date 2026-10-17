"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
export type Activity = { id: string; type: ActivityType; date: string; note: string; cost?: number };
export type Advice = { recommendation: Text; why: Text; steps: Text[]; missing: Text[]; icons?: string[] }; // icons[i] pictures steps[i]
export type Message =
  | { id: string; role: "user"; text: string; photo?: string }
  | { id: string; role: "ai"; text?: string; advice?: Advice };

type State = { lang: Lang; profile: Profile | null; tasks: Task[]; activities: Activity[]; messages: Message[] };
const empty: State = { lang: "en", profile: null, tasks: [], activities: [], messages: [] };
const browserLang = (): Lang => (["ar", "fr"] as const).find((l) => navigator.language.startsWith(l)) ?? "en";
const KEY = "growmate";

export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
export const daysSince = (d: string) => Math.floor((Date.parse(today()) - Date.parse(d)) / 864e5);

// ponytail: localStorage stands in for the backend API (farm profile, tasks, activities).
// Swap load/save for fetch calls to the backend when it exists; components don't change.
function useFarmState() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    try {
      setState({ ...empty, lang: browserLang(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") });
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

  const s = state ?? empty;
  const set = (patch: Partial<State>) => setState((prev) => ({ ...(prev ?? empty), ...patch }));
  return {
    ready: state !== null,
    ...s,
    setLang: (lang: Lang) => set({ lang }),
    saveProfile: (profile: Profile) => set({ profile }),
    addTask: (title: Text, due: string) => set({ tasks: [{ id: uid(), title, due, done: false }, ...s.tasks] }),
    toggleTask: (id: string) => set({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
    logActivity: (a: Omit<Activity, "id">) => {
      const id = uid();
      set({ activities: [{ ...a, id }, ...s.activities].sort((x, y) => y.date.localeCompare(x.date)) });
      return id; // lets the UI offer Undo
    },
    removeActivity: (id: string) => set({ activities: s.activities.filter((a) => a.id !== id) }),
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
