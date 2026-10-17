"use client";

// Voice in the farmer's language. Two paths, the same calls for every screen:
//   1. the server voice (Azure AI Speech, through /api/stt and /api/tts): works in any browser, Arabic and Darija included;
//   2. the browser's own voice (Web Speech API): Chrome, Edge and Safari, voices depend on what the phone has installed.
// The server voice is tried first when the server says it is configured; any failure falls back to the browser, never to silence.
import { useEffect, useState } from "react";
import { API, get } from "./api";
import { langs, type Lang } from "./i18n";
import { chunks, toWav } from "./voice-pure";

export { voiceCommand, type Command } from "./voice-pure";

const locale = (lang: Lang) => langs.find((l) => l.id === lang)!.speech;

// ---- what this phone and this server can do -------------------------------------------------------------------------------------

let server: boolean | null = null; // null: not asked yet
let asking: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function askServer() {
  if (server !== null || asking || !API) return;
  asking = get<{ available: boolean }>("/api/speech/status", 4000)
    .then((s) => { server = !!s.available; }, () => { server = null; })   // unreachable now: ask again next time
    .finally(() => { asking = null; subscribers.forEach((f) => f()); });
}

const hasRecognition = () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window !== "undefined" && "AudioContext" in window;
const online = () => typeof navigator === "undefined" || navigator.onLine;
const useServer = () => server === true && online();

export const canSpeak = () => useServer() || (typeof window !== "undefined" && "speechSynthesis" in window);
export const canListen = () => (useServer() && canRecord()) || hasRecognition();

/** Re-renders once the server has said whether it has a voice, so buttons appear without a reload. */
export function useVoiceReady() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subscribers.add(f);
    askServer();
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => { subscribers.delete(f); window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);
}

/** Which voice a farmer is getting, for the small honest label under the mic. */
export const voiceKind = () => (useServer() ? "server" : hasRecognition() || (typeof window !== "undefined" && "speechSynthesis" in window) ? "browser" : "none");

// ---- speaking ---------------------------------------------------------------------------------------------------------------------

let run = 0;                       // each call to speak() or stopSpeaking() starts a new run; an older run stops itself
let audio: HTMLAudioElement | null = null;

async function fetchMp3(text: string, lang: Lang): Promise<string> {
  const res = await fetch(`${API}/api/tts`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

function play(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    audio = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("audio"));
    a.play().catch(reject);   // the phone may refuse to play without a tap: the caller then falls back to the browser voice
  });
}

function browserSpeak(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale(lang);
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

/** Read `text` aloud. `onEnd` is called when it has finished, was stopped, or could not be played. */
export function speak(text: string, lang: Lang, onEnd?: () => void) {
  stopSpeaking();
  const mine = ++run;
  const pieces = chunks(text);
  (async () => {
    let i = 0;
    if (useServer()) {
      try {
        let next: Promise<string> | undefined = pieces[0] ? fetchMp3(pieces[0], lang) : undefined;
        for (; i < pieces.length; i++) {
          const url = await next!;
          if (mine !== run) { URL.revokeObjectURL(url); return; }
          next = pieces[i + 1] ? fetchMp3(pieces[i + 1], lang) : undefined;   // the next piece is fetched while this one plays
          next?.catch(() => {});
          try { await play(url); } finally { URL.revokeObjectURL(url); }
          if (mine !== run) return;
        }
        return;
      } catch {
        if (mine !== run) return;   // the rest is spoken by the browser, from the piece that failed
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      for (; i < pieces.length && mine === run; i++) await browserSpeak(pieces[i], lang);
    }
  })().finally(() => { if (mine === run) onEnd?.(); });
}

export function stopSpeaking() {
  run++;
  if (audio) { audio.onended = audio.onerror = null; audio.pause(); audio = null; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}

// ---- listening --------------------------------------------------------------------------------------------------------------------

export type ListenError = "blocked" | "nothing" | "insecure" | "offline" | "failed" | "unsupported";
export type Listening = { stop: () => void };   // stop(): send what was said so far

const SPEECH_RMS = 0.02;      // louder than this counts as speech
const SILENCE_MS = 1400;      // stop this long after the farmer stops talking
const NO_SPEECH_MS = 6000;    // give up if nothing was said
const MAX_MS = 20000;

function browserListen(lang: Lang, onText: (t: string) => void, onEnd: () => void, onError?: (e: ListenError) => void): Listening {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SR) { onError?.("unsupported"); onEnd(); return { stop() {} }; }
  const rec = new SR();
  rec.lang = locale(lang);
  rec.interimResults = false;
  let heard = false;
  rec.onresult = (e: any) => { heard = true; onText(e.results[0][0].transcript); };
  rec.onerror = (e: any) => {
    const code = e?.error;
    onError?.(code === "not-allowed" || code === "service-not-allowed" ? "blocked" : code === "no-speech" ? "nothing" : code === "network" ? "offline" : "failed");
  };
  rec.onend = () => { if (!heard) onError?.("nothing"); onEnd(); };
  stopSpeaking();   // don't transcribe our own voice
  rec.start();
  return { stop: () => rec.stop() };
}

function serverListen(lang: Lang, onText: (t: string) => void, onEnd: () => void, onError?: (e: ListenError) => void): Listening {
  let finish: () => void = () => {};
  const handle: Listening = { stop: () => finish() };
  (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      onError?.(window.isSecureContext ? "blocked" : "insecure"); onEnd(); return;
    }
    stopSpeaking();
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const parts: Float32Array[] = [];
    const t0 = Date.now();
    let lastSpeech = 0, spoke = false;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      parts.push(new Float32Array(d));
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const now = Date.now();
      if (Math.sqrt(s / d.length) > SPEECH_RMS) { spoke = true; lastSpeech = now; }
      if ((spoke && now - lastSpeech > SILENCE_MS) || (!spoke && now - t0 > NO_SPEECH_MS) || now - t0 > MAX_MS) finish();
    };
    src.connect(proc); proc.connect(ctx.destination);
    await done;
    proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    ctx.close().catch(() => {});
    if (!spoke) { onError?.("nothing"); onEnd(); return; }
    const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    try {
      const wav = toWav(all, rate);
      const res = await fetch(`${API}/api/stt?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav as BodyInit, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`stt ${res.status}`);
      const { text } = await res.json();
      if (text?.trim()) onText(text.trim()); else onError?.("nothing");
    } catch {
      onError?.(online() ? "failed" : "offline");
    }
    onEnd();
  })();
  return handle;
}

/** Listen to one sentence. The server voice when available (it stops by itself after a short silence), else the browser's. */
export function listen(lang: Lang, onText: (text: string) => void, onEnd: () => void, onError?: (e: ListenError) => void): Listening {
  if (useServer() && canRecord()) return serverListen(lang, onText, onEnd, onError);
  return browserListen(lang, onText, onEnd, onError);
}

// ---- spoken commands (understood on the phone, no server call) ----------------------------------------------------------------------

