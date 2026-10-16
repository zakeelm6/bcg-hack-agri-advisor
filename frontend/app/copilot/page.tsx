"use client";

import { useEffect, useRef, useState } from "react";
import { askCopilot } from "@/lib/copilot";
import { today, uid, useFarm, type Advice } from "@/lib/farm";

const starters = [
  { title: "Water & irrigation", sub: "Plan your next irrigation", q: "Should I irrigate today?" },
  { title: "Crop problems", sub: "Investigate a plant issue", q: "Some leaves are turning yellow. What could it be?" },
  { title: "Costs & profit", sub: "Understand your spending", q: "How are my costs looking?" },
  { title: "Today's tasks", sub: "Plan your farm work", q: "What should I do on the farm today?" },
];

export default function CoPilot() {
  const farm = useFarm();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [farm.messages.length, busy]);

  async function send(q = text) {
    if ((!q.trim() && !photo) || busy) return;
    const question = q.trim() || "What's wrong with this crop?";
    farm.addMessages({ id: uid(), role: "user", text: question, photo });
    setText(""); setPhoto(undefined); setError(""); setBusy(true);
    try {
      const advice = await askCopilot(question, photo, { profile: farm.profile!, activities: farm.activities, tasks: farm.tasks });
      farm.addMessages({ id: uid(), role: "ai", advice });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
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

  function listen() {
    // Native Web Speech API: Chrome/Safari/Edge. Firefox lacks it, so the mic button just hides there.
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.interimResults = false;
    rec.onresult = (e: any) => setText((t) => `${t} ${e.results[0][0].transcript}`.trim());
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }
  const canListen = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <div className="mx-auto max-w-3xl pb-16">
      {farm.messages.length === 0 ? (
        <section className="pt-6 md:pt-12">
          <p className="label">Your farming assistant</p>
          <h1 className="mt-2 font-serif text-[2rem] leading-tight md:text-5xl">What does your farm need today?</h1>
          <p className="mt-3 text-muted">Ask, describe a problem, or share a photo.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {starters.map((s) => (
              <button key={s.title} onClick={() => send(s.q)} className="card text-left active:scale-[.98]">
                <div className="font-medium">{s.title}</div>
                <div className="mt-1 text-sm text-muted">{s.sub}</div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4 pt-2">
          {farm.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl md:max-w-[75%] rounded-br-sm bg-leaf px-4 py-3 text-white">
                {m.photo && <img src={m.photo} alt="Crop photo you shared" className="mb-2 max-h-48 rounded-lg" />}
                {m.text}
              </div>
            ) : m.advice ? (
              <AdviceCard key={m.id} advice={m.advice} />
            ) : (
              <div key={m.id} className="card">{m.text}</div>
            ),
          )}
          {busy && <div className="card w-fit animate-pulse text-muted">Looking at your farm records…</div>}
          {error && <div role="alert" className="card border-red-200 text-red-700">{error}</div>}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="fixed inset-x-0 bottom-[68px] mx-auto max-w-md px-4 pb-2 md:bottom-0 md:max-w-3xl md:px-8 md:pb-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        {photo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-card p-2">
            <img src={photo} alt="Selected crop photo" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 text-sm text-muted">Photo ready to send</span>
            <button type="button" onClick={() => setPhoto(undefined)} className="px-2 text-muted" aria-label="Remove photo">✕</button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1.5 shadow-sm">
          <label className="cursor-pointer rounded-xl p-2.5 text-muted hover:bg-paper" aria-label="Add a photo">
            <Icon d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything about your farm…"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none" aria-label="Message" />
          {canListen && (
            <button type="button" onClick={listen} aria-label="Speak your question"
              className={`rounded-xl p-2.5 ${listening ? "bg-red-50 text-red-600" : "text-muted hover:bg-paper"}`}>
              <Icon d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3" />
            </button>
          )}
          <button disabled={busy || (!text.trim() && !photo)} aria-label="Send" className="rounded-xl bg-leaf p-2.5 text-white disabled:opacity-40">
            <Icon d="M5 12h14M13 6l6 6-6 6" />
          </button>
        </div>
      </form>
    </div>
  );
}

function AdviceCard({ advice }: { advice: Advice }) {
  const { addTask } = useFarm();
  const [due, setDue] = useState(today());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const steps = advice.steps.slice(0, 3); // ponytail: concise UI caps at 3 steps; full list lives in the backend reply

  useEffect(() => () => { speechSynthesis.cancel(); }, []);

  function speak() {
    // Native Web Speech synthesis: speaks the advice aloud, no audio files or deps.
    speechSynthesis.cancel();
    if (speaking) return setSpeaking(false);
    const u = new SpeechSynthesisUtterance([advice.recommendation, ...steps].join(". "));
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(u);
  }

  return (
    <article className="card space-y-3">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-serif text-lg leading-snug">{advice.recommendation}</p>
        {typeof speechSynthesis !== "undefined" && (
          <button type="button" onClick={speak} aria-label={speaking ? "Stop reading" : "Read aloud"} aria-pressed={speaking}
            className={`shrink-0 rounded-xl p-2 ${speaking ? "bg-leaf-soft text-leaf" : "text-muted hover:bg-paper"}`}>
            <Icon d={speaking ? "M7 7h10v10H7z" : "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"} />
          </button>
        )}
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-[15px]">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer">Why?</summary>
        <p className="mt-1 leading-relaxed">{advice.why}</p>
        {advice.missing.length > 0 && <p className="mt-1"><span className="font-medium text-sun">Missing:</span> {advice.missing.join(", ")}</p>}
      </details>
      {saved ? (
        <p className="text-sm font-medium text-leaf">✓ Saved to your tasks on My Farm</p>
      ) : saving ? (
        <div className="flex gap-2">
          <input type="date" className="field flex-1" value={due} min={today()} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          <button className="btn" onClick={() => { addTask(advice.recommendation, due); setSaved(true); }}>Save</button>
        </div>
      ) : (
        <button className="btn-ghost w-full" onClick={() => setSaving(true)}>Save as a task</button>
      )}
    </article>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
