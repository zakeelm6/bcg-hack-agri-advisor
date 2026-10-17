"use client";
// The Copilot: chat with the engine-based Copilot of the API, voice in and out through useVoice, fixed answers offline.
// It explains and never invents a number: every answer comes from /api/copilot (or from the saved advice when offline).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { fetchJson, type CopilotOut, type CopilotStatusOut, type StateOut, type TaskOut } from "@/lib/api";
import { useAppState, useOffline } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import type { Key } from "@/lib/i18n";
import { useVoice } from "@/lib/useVoice";
import { Ic } from "./legacy-ui";

type Msg = { role: "user"; text: string } | { role: "bot"; text: string; source?: string; note?: string | null; actions?: { label: string; go: string }[] };

const CMD_STOP = /^\s*(stop|be quiet|silence|arr[eê]te|tais[- ]toi|توقف|اسكت|قف)/i;
const CMD_REPEAT = /(repeat|say (it )?again|r[ée]p[èe]te|encore une fois|أعد|كرر)/i;
const CMD_TASKS = /(read|list|tell).*(task|to ?do)|my tasks|mes t[âa]ches|lis.*t[âa]ches|اقرأ.*مهام|مهامي/i;

/** Offline Copilot: the fixed questions answered from the advice saved on the device. */
function localAnswer(t: (k: Key, v?: Record<string, string | number>) => string, s: StateOut | null | undefined, q: string, taskId: number | null): Msg {
  const open = (s?.tasks ?? []).filter((x) => x.status === "open");
  const task = open.find((x) => x.id === taskId) ?? open[0], l = q.toLowerCase();
  const say = (text: string): Msg => ({ role: "bot", text, source: "saved" });
  const conf = (c: string) => (c === "High" ? t("confHigh") : c === "Medium" ? t("confMedium") : t("confLow"));
  if (/plan|today|summary|to do|tasks|resume|résumé|aujourd|tâches|taches|اليوم|مهام|خطتي/.test(l) && !/plan b|بديل/.test(l))
    return say(open.length ? t("openTasksN", { n: open.length }) + open.map((x) => `${x.title} (${x.when_text})`).join("; ") + "." : t("noOpenTask"));
  if (!task) return say(t("noTaskToTalk"));
  if (/plan b|cannot|can't|alternative|instead|sinon|بديل/.test(l)) return say(t("planBFor", { t: task.title, p: task.plan_b }));
  if (/sure|confiden|certain|reliable|accurate|confiance|fiable|ثقة|متأكد/.test(l)) return say(t("confFor", { t: task.title, c: conf(task.confidence), r: task.conf_reason }));
  if (/cost|price|how much|coût|cout|combien|prix|كم|تكلفة|سعر/.test(l)) return say(t("costFor", { t: task.title, c: task.cost }));
  if (/when|what time|date|quand|متى|موعد/.test(l)) return say(t("costFor", { t: task.title, c: task.when_text }));
  if (/why|reason|explain|pourquoi|raison|لماذا|ليش|سبب/.test(l)) return say(t("whyFor", { t: task.title, w: task.why, c: conf(task.confidence), r: task.conf_reason }));
  return say(t("needConnection"));
}

type CopilotApi = { open: boolean; setOpen: (v: boolean) => void; speakTask: (task: TaskOut) => void; slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void };
const Ctx = createContext<CopilotApi | null>(null);
export const useCopilot = () => useContext(Ctx)!;

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const speakRef = useRef<(task: TaskOut) => void>(() => {});
  return (
    <Ctx.Provider value={{ open, setOpen, slot, setSlot, speakTask: (task) => speakRef.current(task) }}>
      {children}
      <CopilotPanel speakRef={speakRef} />
    </Ctx.Provider>
  );
}

function CopilotPanel({ speakRef }: { speakRef: React.MutableRefObject<(task: TaskOut) => void> }) {
  const t = useT();
  const { lang } = useFarm();
  const { open, setOpen, slot } = useCopilot();
  const docked = !!slot;
  const offline = useOffline();
  const { data: s } = useAppState();
  const voice = useVoice(lang, offline);
  const path = usePathname();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CopilotStatusOut | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [talk, setTalk] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const talkRef = useRef(false), silentRef = useRef(0), box = useRef<HTMLDivElement>(null);
  talkRef.current = talk;
  const taskId = (() => { const m = /^\/tasks\/(\d+)/.exec(path ?? ""); return m ? +m[1] : null; })();
  const task = taskId != null ? s?.tasks.find((x) => x.id === taskId) : undefined;

  useEffect(() => { fetchJson<CopilotStatusOut>("/api/copilot/status").then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => { try { setReadAloud(JSON.parse(localStorage.getItem("fa_speak") ?? "false")); } catch { /* none */ } }, []);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { if (!note) return; const h = setTimeout(() => setNote(null), 3500); return () => clearTimeout(h); }, [note]);

  const listenAgain = useCallback(() => { if (talkRef.current) setTimeout(() => void micTurn(), 250); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (text: string, fromVoice = false) => {
    const q = text.trim(); if (!q || busy) return;
    if (CMD_STOP.test(q)) { voice.stopSpeaking(); setTalk(false); setNote(t("stopped")); return; }
    if (CMD_REPEAT.test(q)) { const last = [...msgs].reverse().find((m) => m.role === "bot"); if (last) voice.speak(last.text, listenAgain); return; }
    if (CMD_TASKS.test(q)) { const a = localAnswer(t, s, "plan for today", null); setMsgs((m) => [...m, { role: "user", text: q }, a]); voice.speak(a.text, listenAgain); return; }
    setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    let res: Msg;
    try {
      const r = await fetchJson<CopilotOut>("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, task_id: taskId, lang }) }, 30000);
      res = { role: "bot", text: r.text, source: r.source, note: r.note ?? null, actions: (r.actions as { label: string; go: string }[]) ?? [] };
    } catch { res = localAnswer(t, s, q, taskId); }
    setBusy(false); setMsgs((m) => [...m, res]);
    if (fromVoice || readAloud || talkRef.current) voice.speak(res.text, listenAgain); else listenAgain();
  }, [busy, msgs, voice, t, s, taskId, lang, readAloud, listenAgain]);

  const micTurn = useCallback(async () => {
    const heard = await voice.listen();
    if (heard) { silentRef.current = 0; void send(heard, true); }
    else if (talkRef.current) { if (++silentRef.current >= 2) { setTalk(false); setNote(t("talkOff")); } else setTimeout(() => void micTurn(), 300); }
  }, [voice, send, t]);

  const onMic = () => {
    if (voice.state === "speaking") { voice.stopSpeaking(); setTalk(false); return; }
    if (voice.state === "listening") { setTalk(false); voice.stopListening(); return; }
    void micTurn();
  };
  const onTalk = () => {
    if (talk) { setTalk(false); voice.stopSpeaking(); if (voice.state === "listening") voice.stopListening(); setNote(t("talkOff")); return; }
    if (!voice.hasVoice || offline) return;
    setTalk(true); silentRef.current = 0; setNote(t("talkOn"));
    const a = localAnswer(t, s, "plan for today", null); setMsgs((m) => [...m, { role: "user", text: t("readTasks") }, a]);
    talkRef.current = true; voice.speak(a.text, listenAgain);
  };
  speakRef.current = (tk) => voice.speak(`${tk.title}. ${tk.when_text}. ${tk.why}`);

  const stateText = (): { icon: string; text: string; cls: string } => {
    if (voice.message) return { icon: "info", text: t(voice.message as Key), cls: "text-red-800" };
    if (note) return { icon: "info", text: note, cls: "text-violet" };
    if (voice.state === "listening") return { icon: "mic", text: t("stListening"), cls: "text-red-700" };
    if (busy) return { icon: "clock", text: t("stThinking"), cls: "text-muted" };
    if (voice.state === "speaking") return { icon: "speaker", text: t("stSpeaking"), cls: "text-leaf" };
    if (offline) return { icon: "cloudoff", text: t("stOffline"), cls: "text-muted" };
    if (voice.state === "blocked") return { icon: "keyboard", text: t("stBlocked"), cls: "text-muted" };
    if (voice.state === "novoice") return { icon: "keyboard", text: t("stNoVoice"), cls: "text-muted" };
    if (talk) return { icon: "chat", text: t("stTalk"), cls: "text-violet" };
    return { icon: "mic", text: t("stTap"), cls: "text-violet" };
  };
  const st = stateText();
  const micDisabled = offline || voice.state === "blocked" || voice.state === "novoice" || busy;
  const micStop = voice.state === "speaking" || voice.state === "listening";
  const chips: [string, Key][] = [["speaker", "readTasks"], ["chat", "why"], ["shield", "planBQ"], ["clock", "waitQ"], ["tasks", "planToday"]];
  const srcLabel = (m: Msg) => m.role === "bot" ? ({ engine: t("ruleEngine"), model: t("modelChecked"), saved: t("fromSaved") } as Record<string, string>)[m.source ?? ""] ?? "" : "";

  const hasOwnButton = /^\/tasks\/\d+/.test(path ?? "");
  const panel = (
    <section aria-label={t("copilot")} className={`flex flex-col overflow-hidden bg-card ${docked ? "min-h-[520px] rounded-3xl md:h-full" : "fixed inset-x-0 bottom-0 z-50 mx-auto h-[80vh] w-full max-w-md rounded-t-3xl shadow-2xl md:inset-x-auto md:end-7 md:bottom-7 md:h-[min(660px,84vh)] md:w-[420px] md:rounded-3xl"}`}>
      <header className="flex items-start justify-between bg-violet px-4 pb-2.5 pt-4 text-white">
        <div><b className="flex items-center gap-1.5 text-lg"><Ic name="bulb" size={18} /> {t("copilot")}</b><small className="block min-h-4 text-xs opacity-85">{offline ? t("offline") : status ? (status.mode === "model" ? t("modelChecked") : t("ruleEngine")) : ""}</small></div>
        <span className="inline-flex gap-1">
          <button type="button" onClick={onTalk} aria-pressed={talk} aria-label={t("talkMode")} title={talk ? t("talkOn") : t("talkMode")} className={`grid h-11 w-11 place-items-center rounded-full ${talk ? "bg-white/25" : "opacity-80"}`}><Ic name="chat" size={20} /></button>
          <button type="button" onClick={() => { const v = !readAloud; setReadAloud(v); localStorage.setItem("fa_speak", JSON.stringify(v)); if (!v) voice.stopSpeaking(); setNote(t(v ? "readOn" : "readOff")); }} aria-pressed={readAloud} aria-label={t("readAnswers")} title={t(readAloud ? "readOn" : "readOff")} className={`grid h-11 w-11 place-items-center rounded-full ${readAloud ? "bg-white/25" : "opacity-80"}`}><Ic name={readAloud ? "speaker" : "mute"} size={20} /></button>
          {!docked && <button type="button" onClick={() => { setOpen(false); voice.stopSpeaking(); }} aria-label={t("closeCopilot")} className="grid h-11 w-11 place-items-center rounded-full opacity-80"><Ic name="x" size={20} /></button>}
        </span>
      </header>
      {task && <div className="bg-violet-soft px-4 py-2 text-xs font-bold text-violet">{task.title}</div>}
      <div ref={box} aria-live="polite" className="flex min-h-40 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {!msgs.length && !busy && (
          <div className="m-auto flex flex-col items-center gap-3 p-5 text-center">
            {voice.hasVoice && !offline ? <button type="button" onClick={onMic} aria-label={t("speak")} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-violet-soft text-violet"><Ic name="mic" size={34} /></button> : <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-violet-soft text-violet"><Ic name="keyboard" size={34} /></span>}
            <p className="font-semibold text-muted">{voice.hasVoice && !offline ? t("askField") : t("typeQuestion")}</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[90%] ${m.role === "user" ? "self-end" : "self-start"}`}>
            <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-leaf text-paper" : "border border-line bg-white dark:bg-card"}`}>{m.text}</div>
            {m.role === "bot" && (<>
              <div className="mx-2 mt-1 text-xs text-muted">{srcLabel(m)}{m.note && <><br /><span className="text-amber-800">{m.note}</span></>}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => voice.speak(m.text)} aria-label={t("readAloud")} className="grid h-11 w-11 place-items-center rounded-full border-2 border-violet text-violet"><Ic name="speaker" size={16} /></button>
                {(m.actions ?? []).map((a) => <button key={a.go} type="button" onClick={() => { if (!docked) setOpen(false); router.push(a.go.replace(/^#\/soil\//, "/field/soil/").replace(/^#\/task\//, "/tasks/").replace(/^#\//, "/")); }} className="min-h-11 rounded-full border-2 border-violet px-3.5 text-sm font-semibold text-violet">{a.label}</button>)}
              </div>
            </>)}
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl border border-line bg-white px-4 py-3 tracking-[4px] opacity-60 dark:bg-card">...</div>}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1 [mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] md:flex-wrap md:[mask-image:none] rtl:[mask-image:linear-gradient(to_left,#000_calc(100%-40px),transparent)]" style={{ scrollbarWidth: "none" }}>
        {chips.map(([icon, key]) => <button key={key} type="button" onClick={() => void send(key === "why" ? "Why?" : key === "planBQ" ? "Plan B?" : key === "waitQ" ? "What if I wait 2 days?" : key === "planToday" ? "My plan for today" : "Read my tasks")} className="inline-flex min-h-12 flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-violet-soft px-4 text-sm font-semibold text-violet"><Ic name={icon} size={16} />{t(key)}</button>)}
      </div>
      <div className="flex items-center gap-2.5 px-4 pb-1.5 pt-2">
        <button type="button" onClick={onMic} disabled={micDisabled && !micStop} aria-label={micStop ? t("stop") : t("speak")}
          className={`grid h-16 w-16 flex-none place-items-center rounded-full text-white shadow-lg disabled:opacity-40 disabled:shadow-none ${voice.state === "listening" ? "animate-pulse bg-red-700" : voice.state === "speaking" ? "bg-leaf ring-4 ring-leaf/25" : busy ? "bg-muted" : "bg-violet"}`}>
          <Ic name={micStop ? "stop" : "mic"} size={30} />
        </button>
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); const v = input; setInput(""); void send(v); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={400} placeholder={t("ask")} aria-label={t("ask")} className="min-w-0 flex-1 rounded-full border-2 border-violet-line bg-white px-4 py-3.5 dark:bg-card" />
          <button type="submit" aria-label={t("send")} className="grid h-12 w-12 flex-none place-items-center rounded-full bg-violet text-white"><Ic name="send" size={22} /></button>
        </form>
      </div>
      {voice.state === "listening" && <div aria-hidden className="mx-4 h-1.5 overflow-hidden rounded-full bg-violet-soft"><i className="block h-full bg-red-700 transition-[width] duration-75" style={{ width: `${Math.round(voice.level * 100)}%` }} /></div>}
      <p aria-live="polite" className={`m-0 flex min-h-8 items-center justify-center gap-1.5 px-4 pb-3 pt-1 text-center text-sm font-semibold ${st.cls}`}><Ic name={st.icon} size={16} /><span>{st.text}</span></p>
    </section>
  );

  if (docked) return (<>
    {createPortal(panel, slot!)}
    {/* phones: the docked panel sits below the land, so a floating button brings the mic within thumb reach */}
    <button type="button" onClick={() => slot!.scrollIntoView({ behavior: "smooth", block: "start" })} aria-label={t("openCopilot")} className="fixed bottom-24 end-4 z-40 inline-flex h-[60px] items-center gap-2 rounded-full bg-violet px-5 font-bold text-white shadow-2xl md:hidden"><Ic name="mic" size={24} /><span>{t("copilot")}</span></button>
  </>);
  return (<>
    {!open && !hasOwnButton && <button type="button" onClick={() => setOpen(true)} aria-label={t("openCopilot")} className="fixed bottom-24 end-4 z-40 inline-flex h-[60px] items-center gap-2 rounded-full bg-violet px-5 font-bold text-white shadow-2xl md:bottom-7 md:end-7"><Ic name="mic" size={24} /><span>{t("copilot")}</span></button>}
    {open && panel}
  </>);
}

/** On the home page the panel is rendered inside the page layout: this element receives it (through a portal). */
export function CopilotDock({ className }: { className?: string }) {
  const { setSlot } = useCopilot();
  const ref = useCallback((el: HTMLElement | null) => setSlot(el), [setSlot]);
  useEffect(() => () => setSlot(null), [setSlot]);
  return <section ref={ref} aria-label="Copilot" className={className} />;
}
