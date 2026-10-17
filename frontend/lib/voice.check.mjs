// Run: node lib/voice.check.mjs  (the pure parts of the voice layer: cutting text, the WAV recording, spoken orders)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("./voice-pure.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { chunks, toWav, voiceCommand } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
const parts = chunks(long);
assert.ok(parts.length > 1 && parts.every((p) => p.length <= 260), "long text is cut in pieces");
assert.equal(parts.join(" ").replace(/\s+/g, " "), long, "nothing is lost when cutting");
assert.deepEqual(chunks("مرحبا بك. كيف حالك؟"), ["مرحبا بك. كيف حالك؟"]);
assert.deepEqual(chunks("   "), []);

const wav = toWav(new Float32Array(48000).fill(0.5), 48000);
assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
assert.equal(wav.length, 44 + 16000 * 2, "resampled to 16 kHz, 16 bit");
assert.equal(new DataView(wav.buffer).getUint32(24, true), 16000);

assert.equal(voiceCommand("stop"), "stop");
assert.equal(voiceCommand("arrête"), "stop");
assert.equal(voiceCommand("وقف"), "stop");
assert.equal(voiceCommand("repeat that"), "repeat");
assert.equal(voiceCommand("read my tasks"), "read");
assert.equal(voiceCommand("lis mes tâches"), "read");
assert.equal(voiceCommand("Should I stop watering the tomatoes in the north zone this week"), null);
assert.equal(voiceCommand("When should I irrigate?"), null);
console.log("voice checks OK");
