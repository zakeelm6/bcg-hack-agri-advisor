// Pure helpers of the voice layer (no browser, no React), so they can be checked with node.

/** Cut at sentence ends into pieces of about 240 characters: short pieces start sooner and survive browsers that cut long texts. */
export function chunks(text: string, max = 240): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?؟۔…]+[.!?؟۔…]*/g) ?? [];
  const out: string[] = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    if (out.length && out[out.length - 1].length + p.length < max) out[out.length - 1] += ` ${p}`;
    else out.push(p.length > max ? p.slice(0, max) : p);
  }
  return out;
}

/** 16 kHz mono 16-bit WAV from float samples taken at `rate`. */
export function toWav(samples: Float32Array, rate: number): Uint8Array {
  const ratio = rate / 16000;
  const n = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * ratio), to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to && j < samples.length; j++) sum += samples[j];
    const v = Math.max(-1, Math.min(1, sum / (to - from)));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const out = new Uint8Array(44 + n * 2), dv = new DataView(out.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, k) => dv.setUint8(o + k, c.charCodeAt(0)));
  str(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, n * 2, true);
  new Uint8Array(out.buffer, 44).set(new Uint8Array(pcm.buffer));
  return out;
}

export type Command = "read" | "repeat" | "stop";
const WORDS: Record<Command, RegExp> = {
  stop: /\b(stop|arr[eê]te[rz]?|ça suffit|enough)\b|توقف|أوقف|وقف|سالي|بزاف/,
  repeat: /\b(repeat|again|r[eé]p[eè]te[rz]?|encore)\b|أعد|عاود|عاود ليا|كرر/,
  read: /(read|tell).*(task|todo|to do)|(lis|lire|dis).*(t[aâ]ches?|mes t)|اقرأ.*(مهام|المهام)|قرا.*(مهام|المهام|خدمة)|المهام/i,
};
/** A short sentence that is an order to the app rather than a question to the Co-Pilot. */
export function voiceCommand(said: string): Command | null {
  const s = said.toLowerCase().trim();
  if (s.split(/\s+/).length > 6) return null;
  for (const c of ["stop", "repeat", "read"] as const) if (WORDS[c].test(s)) return c;
  return null;
}
