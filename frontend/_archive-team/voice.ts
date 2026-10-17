// Native Web Speech API: speech-to-text and text-to-speech in the farmer's language, no deps.
// Recognition works in Chrome/Edge/Safari (Firefox lacks it). Arabic voices depend on what the phone has installed.
import { langs, type Lang } from "./i18n";

const locale = (lang: Lang) => langs.find((l) => l.id === lang)!.speech;

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
export const canListen = () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (!canSpeak()) return onEnd?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale(lang);
  u.onend = u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };

export function listen(lang: Lang, onText: (text: string) => void, onEnd: () => void) {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = locale(lang);
  rec.interimResults = false;
  rec.onresult = (e: any) => onText(e.results[0][0].transcript);
  rec.onend = onEnd;
  stopSpeaking(); // don't transcribe our own voice
  rec.start();
}
