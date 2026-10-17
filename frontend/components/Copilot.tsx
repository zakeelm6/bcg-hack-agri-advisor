"use client";
// The Copilot: chat with the engine-based Copilot of the API, voice in and out through useVoice, fixed answers offline.
// It explains and never invents a number: every answer comes from /api/copilot (or from the advice saved on the phone).
// Voice is the first interface: one large control whose state is always visible (idle, listening with a live level,
// thinking, speaking with Stop, blocked, no voice, offline), a talk-mode toggle with a clear on state.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { fetchJson, type BriefingOut, type CopilotOut, type CopilotStatusOut, type StateOut, type TaskOut } from "@/lib/api";
import { useAppState, useOffline } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import type { Key } from "@/lib/i18n";
import { useVoice } from "@/lib/useVoice";
import { Badge, Button, Icon } from "./ui";

type Msg = { role: "user"; text: string } | { role: "bot"; text: string; source?: string; note?: string | null; actions?: { label: string; go: string }[] };

const CMD_STOP = /^\s*(stop|be quiet|silence|arr[eê]te|tais[- ]toi|توقف|اسكت|قف|بركا|صافي)/i;
const CMD_REPEAT = /(repeat|say (it )?again|r[ée]p[èe]te|encore une fois|أعد|كرر|عاود)/i;
const CMD_TASKS = /(read|list|tell).*(task|to ?do)|my tasks|mes t[âa]ches|lis.*t[âa]ches|اقرأ.*مهام|مهامي|قرا.*المهام/i;

/** Offline Copilot: the fixed questions answered from the advice saved on the phone. */
function localAnswer(t: (k: Key, v?: Record<string, string | number>) => string, s: StateOut | null | undefined, q: string, taskId: number | null): Msg {
  const open = (s?.tasks ?? []).filter((x) => x.status === "open");
  const task = open.find((x) => x.id === taskId) ?? open[0], l = q.toLowerCase();
  const say = (text: string): Msg => ({ role: "bot", text, source: "saved" });
  const conf = (c: string) => (c === "High" ? t("confHigh") : c === "Medium" ? t("confMedium") : t("confLow"));
  if (/plan|today|summary|to do|tasks|resume|résumé|aujourd|tâches|taches|اليوم|مهام|خطتي|نهاري/.test(l) && !/plan b|بديل/.test(l))
    return say(open.length ? t("openTasksN", { n: open.length }) + open.map((x) => `${x.title} (${x.when_text})`).join("; ") + "." : t("noOpenTask"));
  if (!task) return say(t("noTaskToTalk"));
  if (/plan b|cannot|can't|alternative|instead|sinon|بديل/.test(l)) return say(t("planBFor", { t: task.title, p: task.plan_b }));
  if (/sure|confiden|certain|reliable|accurate|confiance|fiable|ثقة|متأكد/.test(l)) return say(t("confFor", { t: task.title, c: conf(task.confidence), r: task.conf_reason }));
  if (/cost|price|how much|coût|cout|combien|prix|كم|تكلفة|سعر|شحال/.test(l)) return say(t("costFor", { t: task.title, c: task.cost }));
  if (/when|what time|date|quand|متى|موعد|فوقاش/.test(l)) return say(t("costFor", { t: task.title, c: task.when_text }));
  if (/why|reason|explain|pourquoi|raison|لماذا|ليش|سبب|علاش/.test(l)) return say(t("whyFor", { t: task.title, w: task.why, c: conf(task.confidence), r: task.conf_reason }));
  return say(t("needConnection"));
}

type CopilotApi = { open: boolean; setOpen: (v: boolean) => void; speakTask: (task: TaskOut) => void; speakText: (text: string) => void; slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void };
const Ctx = createContext<CopilotApi | null>(null);
export const useCopilot = () => useContext(Ctx)!;

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const speakRef = useRef<(task: TaskOut) => void>(() => {});
  const speakTextRef = useRef<(text: string) => void>(() => {});
  return (
    <Ctx.Provider value={{ open, setOpen, slot, setSlot, speakTask: (task) => speakRef.current(task), speakText: (text) => speakTextRef.current(text) }}>
      {children}
      <CopilotPanel speakRef={speakRef} speakTextRef={speakTextRef} />
    </Ctx.Provider>
  );
}

/** The voice control: the state is the design. 72 px, thumb-sized, with a live ring while listening and a breathing ring while speaking. */
function MicControl({ state, level, busy, onPress, label }: { state: string; level: number; busy: boolean; onPress: () => void; label: string }) {
  const listening = state === "listening", speaking = state === "speaking";
  const disabled = !listening && !speaking && (busy || state === "offline" || state === "blocked" || state === "novoice");
  const ring = listening ? `0 0 0 ${4 + Math.round(level * 14)}px rgb(178 58 42 / .25)` : speaking ? "0 0 0 6px var(--color-brand-soft)" : "var(--shadow-2)";
  const bg = listening ? "bg-danger text-white" : speaking ? "bg-brand-strong text-on-brand" : busy ? "bg-surface-3 text-text-3" : disabled ? "bg-surface-3 text-text-3" : "bg-accent text-on-accent";
  return (
    <button type="button" onClick={onPress} disabled={disabled} aria-label={label}
      className={`pressable grid h-[72px] w-[72px] flex-none place-items-center rounded-full transition-[background-color,box-shadow] duration-150 ${bg} disabled:cursor-not-allowed`} style={{ boxShadow: ring, ["--ring" as string]: "var(--color-brand-soft)", animation: speaking ? "breathe 1.6s ease-in-out infinite" : undefined }}>
      {busy && !listening && !speaking ? <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-[3px] border-current border-t-transparent" /> : <Icon name={listening || speaking ? "stop" : disabled ? "keyboard" : "mic"} size={32} />}
    </button>
  );
}

function CopilotPanel({ speakRef, speakTextRef }: { speakRef: React.MutableRefObject<(task: TaskOut) => void>; speakTextRef: React.MutableRefObject<(text: string) => void> }) {
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
  const [dockVisible, setDockVisible] = useState(false);
  const talkRef = useRef(false), silentRef = useRef(0), box = useRef<HTMLDivElement>(null);
  talkRef.current = talk;
  const taskId = (() => { const m = /^\/tasks\/(\d+)/.exec(path ?? ""); return m ? +m[1] : null; })();
  const task = taskId != null ? s?.tasks.find((x) => x.id === taskId) : undefined;

  useEffect(() => { fetchJson<CopilotStatusOut>("/api/copilot/status").then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => { try { setReadAloud(JSON.parse(localStorage.getItem("fa_speak") ?? "false")); } catch { /* none */ } }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (!note) return; const h = setTimeout(() => setNote(null), 3500); return () => clearTimeout(h); }, [note]);
  useEffect(() => {   // on phones the floating button hides once the docked panel is on screen
    if (!slot) return; const io = new IntersectionObserver(([e]) => setDockVisible(e.isIntersecting), { threshold: 0.2 }); io.observe(slot); return () => io.disconnect();
  }, [slot]);

  const listenAgain = useCallback(() => { if (talkRef.current) setTimeout(() => void micTurn(), 250); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (text: string, fromVoice = false) => {
    const q = text.trim(); if (!q || busy) return;
    if (CMD_STOP.test(q)) { voice.stopSpeaking(); setTalk(false); setNote(t("stopped")); return; }
    if (CMD_REPEAT.test(q)) { const last = [...msgs].reverse().find((m) => m.role === "bot"); if (last) voice.speak(last.text, listenAgain); return; }
    if (CMD_TASKS.test(q)) {
      let a = localAnswer(t, s, "plan for today", null);
      if (!offline) { try { const b = await fetchJson<BriefingOut>(`/api/briefing?lang=${lang}`); a = { role: "bot", text: b.text, source: "engine" }; } catch { /* saved tasks instead */ } }
      setMsgs((m) => [...m, { role: "user", text: q }, a]); voice.speak(a.text, listenAgain); return;
    }
    setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    let res: Msg;
    try {
      const r = await fetchJson<CopilotOut>("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, task_id: taskId, lang }) }, 30000);
      res = { role: "bot", text: r.text, source: r.source, note: r.note ?? null, actions: (r.actions as { label: string; go: string }[]) ?? [] };
    } catch { res = localAnswer(t, s, q, taskId); }
    setBusy(false); setMsgs((m) => [...m, res]);
    if (fromVoice || readAloud || talkRef.current) voice.speak(res.text, listenAgain); else listenAgain();
  }, [busy, msgs, voice, t, s, taskId, lang, readAloud, listenAgain, offline]);

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
  speakTextRef.current = (text) => voice.speak(text);

  const st = ((): { icon: string; text: string; cls: string } => {
    if (voice.message) return { icon: "info", text: t(voice.message as Key), cls: "text-danger" };
    if (note) return { icon: "info", text: note, cls: "text-brand" };
    if (voice.state === "listening") return { icon: "mic", text: t("stListening"), cls: "text-danger" };
    if (busy) return { icon: "clock", text: t("stThinking"), cls: "text-text-2" };
    if (voice.state === "speaking") return { icon: "speaker", text: t("stSpeaking"), cls: "text-brand" };
    if (offline) return { icon: "cloudoff", text: t("stOffline"), cls: "text-text-2" };
    if (voice.state === "blocked") return { icon: "keyboard", text: t("stBlocked"), cls: "text-text-2" };
    if (voice.state === "novoice") return { icon: "keyboard", text: t("stNoVoice"), cls: "text-text-2" };
    if (talk) return { icon: "chat", text: t("stTalk"), cls: "text-brand" };
    return { icon: "mic", text: t("stTap"), cls: "text-text-2" };
  })();
  const micStop = voice.state === "speaking" || voice.state === "listening";
  // the chips send the farmer's own language: the Copilot detects intents in the four languages
  const chips: [string, Key][] = [["speaker", "readTasks"], ["chat", "why"], ["shield", "planBQ"], ["clock", "waitQ"], ["tasks", "planToday"]];
  const src = (m: Msg) => m.role === "bot" ? ({ engine: ["fromRules", "shield"], model: ["fromModel", "sparkle"], saved: ["fromPhone", "cloudoff"] } as Record<string, [Key, string]>)[m.source ?? ""] : undefined;
  const canTalk = voice.hasVoice && !offline;
  const hasOwnButton = /^\/tasks\/\d+/.test(path ?? "") || path === "/" || path === "/design";

  const panel = (
    <section aria-label={t("copilot")} className={`flex flex-col overflow-hidden bg-surface ${docked ? "min-h-[560px] rounded-xl border border-line md:h-full" : "fixed inset-x-0 bottom-0 z-50 mx-auto h-[82dvh] w-full max-w-md rounded-t-2xl shadow-3 md:inset-x-auto md:end-7 md:bottom-7 md:h-[min(680px,84vh)] md:w-[420px] md:rounded-2xl"}`} style={!docked ? { animation: "sheet-up var(--duration-slow) var(--ease-out)" } : undefined}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-soft text-brand"><Icon name="bulb" size={20} /></span>
          <div className="min-w-0"><b className="block font-display text-lg leading-tight">{t("copilot")}</b>
            <span className="block truncate text-xs text-text-2">{offline ? t("offline") : status ? (status.mode === "model" ? t("fromModel") : t("fromRules")) : "\u00a0"}</span></div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onTalk} aria-pressed={talk} disabled={!canTalk} title={t("talkMode")} className={`pressable inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${talk ? "border-brand bg-brand-strong text-on-brand" : "border-line-strong text-text-2 hover:bg-surface-2"}`}>
            <span className={`h-2 w-2 rounded-full ${talk ? "bg-accent" : "bg-line-strong"}`} aria-hidden /><Icon name="chat" size={16} />{t("talk")}
          </button>
          <Button variant="ghost" size="sm" icon={readAloud ? "speaker" : "mute"} iconOnly aria-pressed={readAloud} title={t(readAloud ? "readOn" : "readOff")} onClick={() => { const v = !readAloud; setReadAloud(v); localStorage.setItem("fa_speak", JSON.stringify(v)); if (!v) voice.stopSpeaking(); setNote(t(v ? "readOn" : "readOff")); }}>{t("readAnswers")}</Button>
          {!docked && <Button variant="ghost" size="sm" icon="x" iconOnly onClick={() => { setOpen(false); voice.stopSpeaking(); }}>{t("closeCopilot")}</Button>}
        </div>
      </header>
      {task && <div className="flex items-center gap-2 bg-brand-soft px-4 py-2 text-xs font-semibold text-brand"><Icon name="tasks" size={14} /><span className="truncate">{task.title}</span></div>}
      <div ref={box} aria-live="polite" className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!msgs.length && !busy && (
          <div className="anim-fade-in m-auto flex max-w-xs flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><Icon name={canTalk ? "mic" : "keyboard"} size={30} /></span>
            <p className="font-display text-xl">{canTalk ? t("askField") : t("typeQuestion")}</p>
            <p className="text-sm text-text-2">{t("copilotIntro")}</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const sb = src(m);
          return (
            <div key={i} className={`anim-fade-up max-w-[88%] ${m.role === "user" ? "self-end" : "self-start"}`}>
              <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed ${m.role === "user" ? "rounded-ee-md bg-brand-strong text-on-brand" : "rounded-es-md border border-line bg-surface-2"}`}>{m.text}</div>
              {m.role === "bot" && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 ps-1">
                  {sb && <Badge icon={sb[1]}>{t(sb[0])}</Badge>}
                  {m.note && <Badge tone="warning" icon="warning">{m.note}</Badge>}
                  <Button variant="ghost" size="sm" icon="speaker" iconOnly onClick={() => voice.speak(m.text)}>{t("readAloud")}</Button>
                  {(m.actions ?? []).map((a) => <Button key={a.go} variant="secondary" size="sm" iconEnd="chev" onClick={() => { if (!docked) setOpen(false); router.push(a.go.replace(/^#\/soil\//, "/field/soil/").replace(/^#\/task\//, "/tasks/").replace(/^#\//, "/")); }}>{a.label}</Button>)}
                </div>
              )}
            </div>
          );
        })}
        {busy && <div className="anim-fade-up flex items-center gap-1.5 self-start rounded-2xl rounded-es-md border border-line bg-surface-2 px-4 py-4" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="h-2 w-2 animate-bounce rounded-full bg-text-3" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] rtl:[mask-image:linear-gradient(to_left,#000_calc(100%-32px),transparent)] md:flex-wrap md:[mask-image:none]">
        {chips.map(([icon, key]) => <button key={key} type="button" onClick={() => void send(t(key))} className="pressable inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold text-brand hover:bg-surface-2"><Icon name={icon} size={16} />{t(key)}</button>)}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <MicControl state={voice.state} level={voice.level} busy={busy} onPress={onMic} label={micStop ? t("stop") : t("speak")} />
        <div className="min-w-0 flex-1">
          <form className="flex min-w-0 gap-2" onSubmit={(e) => { e.preventDefault(); const v = input; setInput(""); void send(v); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={400} placeholder={t("ask")} aria-label={t("ask")} className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" />
            <Button type="submit" variant="primary" size="sm" icon="send" iconOnly disabled={!input.trim()}>{t("send")}</Button>
          </form>
          <p aria-live="polite" className={`mt-1.5 flex min-h-5 items-center gap-1.5 ps-1 text-sm font-semibold ${st.cls}`}><Icon name={st.icon} size={15} /><span className="truncate">{st.text}</span></p>
        </div>
      </div>
    </section>
  );

  if (docked) return (<>
    {createPortal(panel, slot!)}
    {!dockVisible && <Button variant="accent" size="lg" icon="mic" className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] end-4 z-40 shadow-3 md:hidden" onClick={() => slot!.scrollIntoView({ behavior: "smooth", block: "start" })}>{t("copilot")}</Button>}
  </>);
  return (<>
    {!open && !hasOwnButton && <Button variant="accent" size="lg" icon="mic" className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] end-4 z-40 shadow-3 md:bottom-7 md:end-7" onClick={() => setOpen(true)}>{t("copilot")}</Button>}
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
