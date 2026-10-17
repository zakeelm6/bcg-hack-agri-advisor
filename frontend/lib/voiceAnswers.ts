// Turns what the farmer said into an onboarding answer. Labels of every language are compared after normalisation
// (lower case, no Arabic diacritics or punctuation); a choice wins when its label and the sentence share a word of 3+ letters,
// or when one contains the other. Numbers for the area accept "3", "3.5", "3,5", "trois", "ثلاثة"...
export type Choice = { id: string; labels: string[] };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter((w) => w.length >= 3);
// Arabic script is written without short vowels and recognisers drop long ones too: compare words without alef and final ta marbuta.
const loose = (w: string) => w.replace(/[اأإآ]/g, "").replace(/[ةه]$/, "");
const same = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a) || (a.length >= 3 && b.length >= 3 && loose(a) === loose(b));

export function matchAnswer(text: string, choices: Choice[]): string | null {
  const n = norm(text); if (!n) return null;
  const tw = [...new Set(words(text))];
  let best: { id: string; score: number } | null = null;
  for (const c of choices) {
    let score = 0;
    for (const l of c.labels) {
      const ln = norm(l);
      if (!ln) continue;
      if (n === ln) score = Math.max(score, 10);
      else if (n.includes(ln) || ln.includes(n)) score = Math.max(score, 6);
      else { const shared = words(l).filter((w) => tw.some((x) => same(x, w))).length; if (shared) score = Math.max(score, shared * 2); }
    }
    if (score > (best?.score ?? 0)) best = { id: c.id, score };
  }
  return best && best.score >= 2 ? best.id : null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, demi: 0.5,
  "واحد": 1, "اثنان": 2, "اثنين": 2, "ثلاثة": 3, "ثلاث": 3, "أربعة": 4, "اربعة": 4, "خمسة": 5, "ستة": 6, "سبعة": 7, "ثمانية": 8, "تسعة": 9, "عشرة": 10, "نصف": 0.5, "نص": 0.5,
  "جوج": 2, "تلاتة": 3, "ربعة": 4, "خمسه": 5,
};
export function parseArea(text: string): number | null {
  const raw = text.toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
  const half = /\b(half|demi|demie)\b|نصف|\bنص\b/.test(raw) ? 0.5 : 0;
  const m = /(\d+(?:\.\d+)?)/.exec(raw);
  if (m) { const v = parseFloat(m[1]) + (Number.isInteger(parseFloat(m[1])) ? half : 0); return v > 0 && v <= 10000 ? Math.round(v * 2) / 2 : null; }
  let total = 0, found = false;
  for (const w of norm(raw).split(" ")) { const v = NUMBER_WORDS[w]; if (v != null) { total += v; found = true; } }
  return found && total > 0 ? Math.round(total * 2) / 2 : null;
}
