"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { askCopilot } from "@/lib/copilot";
import { today, uid, useFarm, useT, type Advice } from "@/lib/farm";
import type { Key } from "@/lib/i18n";
import { Icon } from "@/lib/icons";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "@/lib/voice";

const starters: { icon: string; title: Key; q: Key }[] = [
  { icon: "drip", title: "starterWater", q: "askIrrigate" },
  { icon: "bug", title: "starterSick", q: "starterSickQ" },
  { icon: "coins", title: "starterCosts", q: "starterCostsQ" },
  { icon: "tasks", title: "starterToday", q: "askWhatQ" },
];

export default function Page() {
  return <Suspense><CoPilot /></Suspense>;
}

function CoPilot() {
  const farm = useFarm();
  const t = useT();
  const prefill = useSearchParams().get("q") ?? ""; // from shortcuts on other pages
  const [text, setText] = useState(prefill);
  const [typing, setTyping] = useState(!!prefill || !canListen()); // voice first; keyboard on request or when there's no mic support
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const [fresh, setFresh] = useState<string>(); // newest answer: read aloud automatically
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [farm.messages.length, busy]);
  useEffect(() => stopSpeaking, []);

  async function send(q = text) {
    if ((!q.trim() && !photo) || busy) return;
    const question = q.trim() || t("photoQ");
    farm.addMessages({ id: uid(), role: "user", text: question, photo });
    setText(""); setPhoto(undefined); setError(false); setBusy(true);
    try {
      const advice = await askCopilot(question, photo, { profile: farm.profile!, activities: farm.activities, tasks: farm.tasks }, farm.lang);
      const id = uid();
      farm.addMessages({ id, role: "ai", advice });
      setFresh(id);
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

  function talk() {
    setListening(true);
    // Spoken question goes straight out: no reading or typing needed.
    listen(farm.lang, (said) => send(said), () => setListening(false));
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      {farm.messages.length === 0 ? (
        <section className="pt-6 md:pt-12">
          <h1 className="font-serif text-[2rem] leading-tight md:text-5xl">{t("copilotHello")}</h1>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {starters.map((s) => (
              <button key={s.title} onClick={() => send(t(s.q))} className="card flex flex-col items-center gap-2 py-5 text-center active:scale-[.98]">
                <Icon name={s.icon} className="h-9 w-9 text-leaf" />
                <span className="text-lg font-medium">{t(s.title)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4 pt-2">
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
        {typing ? (
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1.5 shadow-sm">
            <PhotoButton label={t("takePhoto")} onPick={pickPhoto} small />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("typeHere")} autoFocus
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-lg outline-none" aria-label={t("typeHere")} />
            {canListen() && (
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
            <button type="button" onClick={talk} disabled={busy || listening} aria-live="polite"
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const steps = advice.steps.slice(0, 3); // ponytail: concise UI caps at 3 steps; full list lives in the backend reply

  function play() {
    setSpeaking(true);
    speak([advice.recommendation, ...steps].join(". "), lang, () => setSpeaking(false));
  }
  useEffect(() => { if (autoPlay) play(); }, [autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className="card space-y-4">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-serif text-xl leading-snug">{advice.recommendation}</p>
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
          <li key={s} className="flex items-start gap-3 text-lg leading-snug">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf"><Icon name={advice.icons?.[i] ?? "check"} className="h-5 w-5" /></span>
            <span className="pt-1.5">{s}</span>
          </li>
        ))}
      </ol>
      <details className="text-muted">
        <summary className="cursor-pointer py-1">{t("why")}</summary>
        <p className="mt-1 leading-relaxed">{advice.why}</p>
        {advice.missing.length > 0 && <p className="mt-1"><span className="font-medium text-sun">{t("missing")}</span> {advice.missing.join(", ")}</p>}
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
