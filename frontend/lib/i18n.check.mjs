// Checks the Darija table against the main translations: every Darija key must exist, and its {placeholders} must be the
// same as the English ones (a wrong placeholder would show a blank or crash a sentence). Run:  node lib/i18n.check.mjs
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
const ary = readFileSync(new URL("./i18n-ary.ts", import.meta.url), "utf8");
const str = (m) => m.replace(/\\"/g, '"');
const english = {}, standardArabic = {};
const body = main.slice(main.indexOf("const S = {"), main.indexOf("} satisfies"));
for (const m of body.matchAll(/(\w+):\s*\[((?:"(?:[^"\\]|\\.)*"\s*,?\s*){3})\]/g)) {
  const parts = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => str(x[1]));
  english[m[1]] = parts[0]; standardArabic[m[1]] = parts[2];
}
const darija = {};
for (const m of ary.matchAll(/^\s*(\w+):\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) darija[m[1]] = str(m[2]);
const fields = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
const problems = [];
for (const [k, v] of Object.entries(darija)) {
  if (!(k in english)) problems.push(`unknown key: ${k}`);
  else if (fields(v) !== fields(english[k])) problems.push(`placeholders differ for ${k}: English {${fields(english[k])}} Darija {${fields(v)}}`);
  if (!/[؀-ۿ]/.test(v)) problems.push(`no Arabic script in ${k}`);
}
const total = Object.keys(english).length, done = Object.keys(darija).length;
console.log(`Darija overrides ${done} of ${total} texts (the rest read the standard Arabic text).`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("OK");
