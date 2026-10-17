"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { askCopilot } from "@/lib/copilot";
import { today, uid, useFarm, useT, useTx, type Advice } from "@/lib/farm";
import { Icon } from "@/lib/icons";
import { PhotoCardBody, photoCard, starters } from "@/lib/starters";
import { openTasks, useEngine } from "@/lib/engine";
import { canListen, canSpeak, listen, speak, stopSpeaking, useVoiceReady, voiceCommand, type ListenError, type Listening } from "@/lib/voice";

const VOICE_MSG: Record<ListenError, "voiceFailed" | "voiceBlocked" | "voiceNothing" | "voiceInsecure" | "voiceOffline"> =
  { blocked: "voiceBlocked", nothing: "voiceNothing", insecure: "voiceInsecure", offline: "voiceOffline", failed: "voiceFailed", unsupported: "voiceFailed" };

export default function Page() {
  return <Suspense><CoPilot /></Suspense>;
}

function CoPilot() {
  const farm = useFarm();
  const t = useT();
  const x = useTx();
  useVoiceReady();
  const { state: engine } = useEngine(farm.lang);
  const params = useSearchParams();
  const prefill = params.get("q") ?? ""; // from shortcuts on other pages
  const autoAsk = params.has("ask"); // My Farm photo cards: send straight away
  const [text, setText] = useState(prefill);
  const [typing, setTyping] = useState((!!prefill && !autoAsk) || !canListen()); // voice first; keyboard on request or when there's no mic support
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const [fresh, setFresh] = useState<string>(); // newest answer: read aloud automatically
  const [voiceMsg, setVoiceMsg] = useState<string>(); // one calm line under the mic: what went wrong or what mode we are in
  const [talking, setTalking] = useState(false);       // talk mode: listen, answer aloud, listen again
  const talkRef = useRef(false);
  const lastSpoken = useRef("");
  const session = useRef<Listening>(undefined);
  const silences = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [farm.messages.length, busy]);
  useEffect(() => () => { talkRef.current = false; session.current?.stop(); stopSpeaking(); }, []);
  const micOk = canListen();
  useEffect(() => { if (micOk && !prefill) setTyping(false); }, [micOk]); // eslint-disable-line react-hooks/exhaustive-deps
  const asked = useRef(false); // guards the double effect run in dev
  useEffect(() => {
    if (autoAsk && prefill && !asked.current) { asked.current = true; send(prefill); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(q = text): Promise<string | undefined> {
    if ((!q.trim() && !photo) || busy) return;
    const question = q.trim() || t("photoQ");
    farm.addMessages({ id: uid(), role: "user", text: question, photo });
    setText(""); setPhoto(undefined); setError(false); setBusy(true);
    try {
      const advice = await askCopilot(question, photo, { profile: farm.profile!, activities: farm.activities, tasks: farm.tasks }, farm.lang);
      const id = uid();
      farm.addMessages({ id, role: "ai", advice });
      if (!talkRef.current) setFresh(id);   // in talk mode the loop reads it, once
      return [advice.recommendation, ...advice.steps.slice(0, 3)].map(x).join(". ");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto(file?: File) {
    if (!file) return;
    // Downscale to ~1024px JPEG: phone photos are 3–8 MB and would blow the storage quota.
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setPhoto(c.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  function oneTask() {
    const tasks = engine ? openTasks(engine.tasks) : [];
    return tasks.length ? tasks.map((k) => `${k.title}. ${k.when_text}.`).join(" ") : t("noTasksToRead");
  }

  /** One turn of listening. A spoken order ("read my tasks", "repeat", "stop") is handled here; anything else is a question. */
  function talk() {
    if (listening) { session.current?.stop(); return; }   // a second tap sends what was said so far
    setListening(true); setVoiceMsg(undefined);
    let handled = false;
    session.current = listen(farm.lang, (said) => { handled = true; silences.current = 0; void turn(said); }, () => {
      setListening(false);
      if (!handled && talkRef.current) { if (++silences.current >= 2) endTalk(); else talk(); }   // two silences in a row end talk mode
    }, (e) => { if (e === "nothing" && talkRef.current) return; setVoiceMsg(t(VOICE_MSG[e])); if (e !== "nothing") endTalk(); });
  }

  async function turn(said: string) {
    const cmd = voiceCommand(said);
    let reply: string | undefined;
    if (cmd === "stop") { endTalk(); stopSpeaking(); return; }
    else if (cmd === "repeat") reply = lastSpoken.current || undefined;
    else if (cmd === "read") reply = oneTask();
    else reply = await send(said);
    if (!reply) { if (talkRef.current) talk(); return; }
    lastSpoken.current = reply;
    speak(reply, farm.lang, () => { if (talkRef.current) talk(); });
  }

  function endTalk() {
    if (talkRef.current) setVoiceMsg(t("talkOff"));
    talkRef.current = false; setTalking(false); silences.current = 0;
  }
  function toggleTalk() {
    if (talkRef.current) { endTalk(); session.current?.stop(); stopSpeaking(); return; }
    talkRef.current = true; setTalking(true); silences.current = 0; setVoiceMsg(t("talkOn"));
    talk();
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      {farm.messages.length === 0 ? (
        <section className="pt-6 md:pt-12">
          <h1 className="font-serif text-[2rem] leading-tight md:text-5xl">{t("copilotHello")}</h1>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {starters.map((s) => (
              <button key={s.title} onClick={() => send(t(s.q))} className={photoCard}><PhotoCardBody s={s} label={t(s.title)} /></button>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4 pt-2">
          <button type="button" onClick={() => { stopSpeaking(); farm.clearMessages(); }} className="text-muted underline underline-offset-4">{t("newChat")}</button>
          {farm.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-sm bg-leaf px-4 py-3 text-lg text-white md:max-w-[75%]">
                {m.photo && <img src={m.photo} alt="" className="mb-2 max-h-48 rounded-lg" />}
                {m.text}
              </div>
            ) : m.advice ? (
              <AdviceCard key={m.id} advice={m.advice} autoPlay={m.id === fresh} />
            ) : (
              <div key={m.id} className="card">{m.text}</div>
            ),
          )}
          {busy && <div className="card w-fit animate-pulse text-muted">{t("thinking")}</div>}
          {error && <div role="alert" className="card border-red-200 text-red-700">{t("error")}</div>}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="fixed inset-x-0 bottom-[76px] mx-auto max-w-md px-4 pb-2 md:bottom-0 md:max-w-3xl md:px-8 md:pb-6">
        {photo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-card p-2">
            <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 text-muted">{t("photoReady")}</span>
            <button type="button" onClick={() => send()} className="btn py-2">{t("send")}</button>
            <button type="button" onClick={() => setPhoto(undefined)} className="px-3 text-xl text-muted" aria-label={t("removePhoto")}>×</button>
          </div>
        )}
        {(voiceMsg || (!typing && micOk)) && (
          <div className="mb-2 flex items-center justify-between gap-2 text-base text-muted">
            <p role="status" aria-live="polite" className="min-w-0 flex-1">{voiceMsg}</p>
            {!typing && micOk && (
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => { stopSpeaking(); const r = oneTask(); lastSpoken.current = r; speak(r, farm.lang); }}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-leaf">{t("readTasks")}</button>
                <button type="button" onClick={toggleTalk} aria-pressed={talking}
                  className={`rounded-full border px-3 py-1.5 ${talking ? "border-leaf bg-leaf text-white" : "border-line bg-card text-leaf"}`}>{t("talkMode")}</button>
              </span>
            )}
          </div>
        )}
        {typing ? (
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1.5 shadow-sm">
            <PhotoButton label={t("takePhoto")} onPick={pickPhoto} small />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("typeHere")} autoFocus
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-lg outline-none" aria-label={t("typeHere")} />
            {micOk && (
              <button type="button" onClick={() => setTyping(false)} aria-label={t("tapSpeak")} className="rounded-xl p-2.5 text-muted hover:bg-paper">
                <Svg d={MIC} />
              </button>
            )}
            <button disabled={busy || (!text.trim() && !photo)} aria-label={t("send")} className="rounded-xl bg-leaf p-2.5 text-white disabled:opacity-40">
              <Svg d="M5 12h14M13 6l6 6-6 6" flip />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <PhotoButton label={t("takePhoto")} onPick={pickPhoto} />
            <button type="button" onClick={talk} disabled={busy} aria-live="polite"
              className={`flex h-16 flex-1 items-center justify-center gap-3 rounded-full text-lg font-semibold text-white shadow-lg ${listening ? "animate-pulse bg-red-600" : "bg-leaf"} disabled:opacity-80`}>
              <Svg d={MIC} big />{listening ? t("listening") : t("tapSpeak")}
            </button>
            <button type="button" onClick={() => setTyping(true)} aria-label={t("typeInstead")}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted"><Icon name="keyboard" /></button>
          </div>
        )}
      </form>
    </div>
  );
}

function PhotoButton({ label, onPick, small }: { label: string; onPick: (f?: File) => void; small?: boolean }) {
  return (
    <label aria-label={label}
      className={small ? "cursor-pointer rounded-xl p-2.5 text-muted hover:bg-paper" : "flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-muted"}>
      {small ? <Svg d={CAMERA} /> : <Icon name="camera" />}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  );
}

function AdviceCard({ advice, autoPlay }: { advice: Advice; autoPlay: boolean }) {
  const { addTask, lang } = useFarm();
  const t = useT();
  const x = useTx(); // stored answers are translated at display time
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const steps = advice.steps.slice(0, 3); // ponytail: concise UI caps at 3 steps; full list lives in the backend reply

  function play() {
    setSpeaking(true);
    speak([advice.recommendation, ...steps].map(x).join(". "), lang, () => setSpeaking(false));
  }
  useEffect(() => { if (autoPlay) play(); }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className="card space-y-4">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-serif text-xl leading-snug">{x(advice.recommendation)}</p>
        {canSpeak() && (
          <button type="button" onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : play())}
            aria-label={speaking ? t("stop") : t("readAloud")} aria-pressed={speaking}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${speaking ? "bg-leaf text-white" : "bg-leaf-soft text-leaf"}`}>
            <Icon name={speaking ? "stop" : "speaker"} />
          </button>
        )}
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-lg leading-snug">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf"><Icon name={advice.icons?.[i] ?? "check"} className="h-5 w-5" /></span>
            <span className="pt-1.5">{x(s)}</span>
          </li>
        ))}
      </ol>
      <details className="text-muted">
        <summary className="cursor-pointer py-1">{t("why")}</summary>
        <p className="mt-1 leading-relaxed">{x(advice.why)}</p>
        {advice.missing.length > 0 && <p className="mt-1"><span className="font-medium text-sun">{t("missing")}</span> {advice.missing.map(x).join(", ")}</p>}
      </details>
      {saved ? (
        <p className="font-medium text-leaf">{t("savedTask")}</p>
      ) : saving ? (
        // Two big choices instead of a date picker.
        <div role="group" aria-label={t("forWhen")} className="grid grid-cols-2 gap-2">
          {(["today", "tomorrow"] as const).map((d) => (
            <button key={d} className="btn" onClick={() => {
              addTask(advice.recommendation, d === "today" ? today() : new Date(Date.now() + 864e5).toISOString().slice(0, 10));
              setSaved(true);
            }}>{t(d)}</button>
          ))}
        </div>
      ) : (
        <button className="btn-ghost w-full" onClick={() => setSaving(true)}>{t("saveTask")}</button>
      )}
    </article>
  );
}

const MIC = "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3";
const CAMERA = "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z";

function Svg({ d, big, flip }: { d: string; big?: boolean; flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`${big ? "h-7 w-7" : "h-5 w-5"} ${flip ? "rtl:-scale-x-100" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
