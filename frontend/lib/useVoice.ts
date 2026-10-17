"use client";
// useVoice: the Copilot's ears and mouth. Server voice (Azure, through the API) first because it works in every browser and in
// Arabic; the browser's Web Speech API as the fallback. Every state is exposed so the UI can always say what is happening:
// idle, listening, thinking (set by the caller), speaking, blocked, novoice, offline. See processing/VOICE.md.
import { useCallback, useEffect, useRef, useState } from "react";
import { API, fetchJson, net, type SpeechStatusOut } from "./api";
import { langs, type Lang } from "./i18n";

export type VoiceState = "idle" | "listening" | "speaking" | "blocked" | "novoice" | "offline";
type SR = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; onstart: (() => void) | null; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void };
const srCtor = (): (new () => SR) | undefined => (typeof window === "undefined" ? undefined : ((window as unknown as { SpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition));
const speechCode = (lang: Lang) => langs.find((l) => l.id === lang)!.speech;

const chunks = (text: string) => {
  const parts = text.replace(/[«»"*_]/g, "").split(/(?<=[.!?؟:;])\s+/).filter((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) { if (out.length && (out[out.length - 1] + " " + p).length < 240) out[out.length - 1] += " " + p; else out.push(p); }
  return out;
};

/** Records the microphone as a 16 kHz WAV; stops by itself when the farmer stops talking. The loudness threshold adapts to the
 *  noise of the place (first 0.3 s), so a noisy field does not keep it open and a quiet one does not cut it short. */
function recordWav(onLevel: (rms: number, floor: number) => void, onLong: () => void, stopRef: { current: (() => void) | null }): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((stream) => {
      const ctx = new AudioContext(); void ctx.resume();
      const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), buf: Float32Array[] = [];
      let heard = false, quiet = 0, total = 0, done = false, floor = 0.01, floorN = 0, warned = false;
      const finish = () => {
        if (done) return; done = true; stopRef.current = null;
        try { proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); } catch { /* closed */ }
        resolve(heard ? encodeWav(buf, ctx.sampleRate) : null);
      };
      stopRef.current = finish;
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0); buf.push(new Float32Array(d)); total += d.length / ctx.sampleRate;
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const rms = Math.sqrt(sum / d.length);
        if (total < 0.3) { floor = (floor * floorN + rms) / (floorN + 1); floorN++; }
        const speech = Math.min(0.08, Math.max(0.015, floor * 3)), silence = Math.max(0.01, floor * 1.5);
        if (rms > speech) { heard = true; quiet = 0; } else if (rms < silence || !heard) quiet += d.length / ctx.sampleRate;
        onLevel(rms, floor);
        if (total > 12 && !warned) { warned = true; onLong(); }
        if ((heard && quiet > 1.4) || (!heard && total > 6) || total > 20) finish();
      };
      src.connect(proc); proc.connect(ctx.destination);
    }, reject);
  });
}
function encodeWav(parts: Float32Array[], rate: number): Blob {
  let len = 0; parts.forEach((c) => { len += c.length; });
  const all = new Float32Array(len); let o = 0; parts.forEach((c) => { all.set(c, o); o += c.length; });
  const ratio = rate / 16000, n = Math.floor(len / ratio), b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (p: number, t: string) => { for (let i = 0; i < t.length; i++) b.setUint8(p + i, t.charCodeAt(i)); };
  w(0, "RIFF"); b.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * ratio)])); b.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([b], { type: "audio/wav" });
}

export function useVoice(lang: Lang, offline: boolean) {
  const [server, setServer] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [level, setLevel] = useState(0);
  const [message, setMessage] = useState<string | null>(null);   // a passing message (error, "still listening"), cleared after 3.5 s
  const speakId = useRef(0), audio = useRef<HTMLAudioElement | null>(null), stopRec = useRef<(() => void) | null>(null), rec = useRef<SR | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    fetchJson<SpeechStatusOut>("/api/speech/status").then((s) => setServer(!!s.available)).catch(() => setServer(false));
    if ("speechSynthesis" in window) { const load = () => setVoices(speechSynthesis.getVoices()); load(); speechSynthesis.onvoiceschanged = load; }
  }, []);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 3500); return () => clearTimeout(t); }, [message]);

  const hasBrowserIn = !!srCtor() && !blocked;
  const state: VoiceState = listening ? "listening" : speaking ? "speaking" : offline ? "offline" : blocked ? "blocked" : !(server || hasBrowserIn) ? "novoice" : "idle";

  const stopSpeaking = useCallback(() => {
    speakId.current++;
    try { if (audio.current) { audio.current.pause(); audio.current.src = ""; audio.current = null; } } catch { /* nothing playing */ }
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* none */ }
    setSpeaking(false);
  }, []);

  const browserSpeak = useCallback((text: string, done?: () => void) => {
    if (!("speechSynthesis" in window) || !text) { done?.(); return; }
    const id = ++speakId.current, code = speechCode(lang);
    const norm = (v: SpeechSynthesisVoice) => (v.lang || "").toLowerCase().replace("_", "-");
    const same = voices.filter((v) => norm(v).startsWith(code.slice(0, 2).toLowerCase()));
    const voice = same.find((v) => norm(v) === code.toLowerCase()) ?? same[0] ?? null;
    if (voices.length && !voice) setMessage("noVoiceLang");
    const parts = text.replace(/[«»"*_]/g, "").split(/(?<=[.!?؟:])\s+/).filter((p) => p.trim());
    setSpeaking(true);
    const next = (i: number) => {
      if (id !== speakId.current) return;
      if (i >= parts.length) { setSpeaking(false); done?.(); return; }
      const u = new SpeechSynthesisUtterance(parts[i]); u.lang = code; u.rate = 0.95; if (voice) u.voice = voice;
      u.onend = () => next(i + 1); u.onerror = () => { if (id === speakId.current) setSpeaking(false); };
      speechSynthesis.speak(u);
    };
    next(0);
  }, [lang, voices]);

  const serverSpeak = useCallback(async (text: string, done?: () => void) => {
    const id = ++speakId.current, cs = chunks(text);
    setSpeaking(true);
    const tts = async (t: string) => { const r = await fetch(API + "/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, lang }) }); if (!r.ok) throw new Error("tts"); return URL.createObjectURL(await r.blob()); };
    let next: Promise<string> | null = tts(cs[0]);
    for (let i = 0; i < cs.length; i++) {
      let url: string;
      try { url = await next!; } catch { if (id === speakId.current) { setSpeaking(false); browserSpeak(cs.slice(i).join(" "), done); } return; }
      if (id !== speakId.current) { URL.revokeObjectURL(url); return; }
      next = i + 1 < cs.length ? tts(cs[i + 1]) : null;
      const ok = await new Promise<boolean>((res) => { const a = new Audio(url); audio.current = a; a.onended = () => res(true); a.onerror = () => res(false); a.play().catch(() => res(false)); });
      URL.revokeObjectURL(url);
      if (id !== speakId.current) return;
      if (!ok) { setSpeaking(false); browserSpeak(cs.slice(i + 1).join(" "), done); return; }
    }
    setSpeaking(false); done?.();
  }, [lang, browserSpeak]);

  const speak = useCallback((text: string, done?: () => void) => { stopSpeaking(); if (server && !net.offline && text) void serverSpeak(text, done); else browserSpeak(text, done); }, [server, serverSpeak, browserSpeak, stopSpeaking]);

  /** Listen once; resolves with the text (empty when nothing was heard). */
  const listen = useCallback((): Promise<string> => new Promise((resolve) => {
    stopSpeaking();
    if (server && !net.offline) {
      if (!navigator.mediaDevices || !window.isSecureContext) { setMessage("voiceSecure"); return resolve(""); }
      setListening(true);
      recordWav((rms, floor) => setLevel(Math.min(1, rms / Math.max(0.08, floor * 6))), () => setMessage("stillListening"), stopRec)
        .then(async (blob) => {
          setListening(false);
          if (!blob) { setMessage("heardNothing"); return resolve(""); }
          try {
            const r = await fetchJson<{ text: string }>(`/api/stt?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob }, 20000);
            const text = (r.text || "").trim(); if (!text) setMessage("heardNothing"); resolve(text);
          } catch { setMessage("voiceFailed"); resolve(""); }
        }, (e: { name?: string }) => { setListening(false); if (e?.name === "NotAllowedError") setBlocked(true); setMessage(e?.name === "NotAllowedError" ? "stBlocked" : "voiceFailed"); resolve(""); });
      return;
    }
    const Ctor = srCtor();
    if (!Ctor) { setMessage("stNoVoice"); return resolve(""); }
    const r = new Ctor(); let finalText = "", interim = "";
    r.lang = speechCode(lang); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onstart = () => setListening(true);
    r.onresult = (e) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t; } interim = t; };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") setBlocked(true); setMessage(e.error === "not-allowed" || e.error === "service-not-allowed" ? "stBlocked" : e.error === "no-speech" ? "heardNothing" : e.error === "network" ? "stOffline" : "voiceFailed"); };
    r.onend = () => { setListening(false); rec.current = null; resolve((finalText || interim).trim()); };
    rec.current = r;
    try { r.start(); } catch { setMessage("voiceFailed"); resolve(""); }
  }), [lang, server, stopSpeaking]);

  const stopListening = useCallback(() => { if (stopRec.current) stopRec.current(); else rec.current?.stop(); }, []);

  return { state, server, level, message, speak, stopSpeaking, listen, stopListening, hasVoice: server || hasBrowserIn };
}
