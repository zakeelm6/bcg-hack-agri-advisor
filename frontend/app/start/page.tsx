"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFarm, useT, type Profile } from "@/lib/farm";
import { useActions } from "@/lib/data";
import { challenges, cropName, crops, irrigations, plantedChoices, tr, type Key } from "@/lib/i18n";
import { Icon } from "@/lib/icons";
import { useVoice } from "@/lib/useVoice";
import { useOffline } from "@/lib/data";
import { Button, FormField, Icon as UiIcon } from "@/components/ui";
import { matchAnswer, parseArea, type Choice } from "@/lib/voiceAnswers";

const blank: Profile = { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" };
const weeksAgo = (w: number) => new Date(Date.now() - w * 7 * 864e5).toISOString().slice(0, 10);

// Reverse-geocodes GPS to a town name (BigDataCloud client endpoint: free, keyless, only called when the farmer taps the button).
async function townAt(lat: number, lon: number, lang: string) {
  const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`).then((x) => x.json());
  return r.city || r.locality || r.principalSubdivision || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function Onboarding() {
  const { profile, saveProfile, lang, mode } = useFarm();
  const { act } = useActions();
  const t = useT();
  const router = useRouter();
  const [p, setP] = useState<Profile>(profile ?? blank);
  const edit = useSearchParams().has("edit");
  const [step, setStep] = useState(0);   // the landing page (/) is the welcome; here the questions start at once
  const [locating, setLocating] = useState<"" | "busy" | "failed">("");
  const offline = useOffline();
  const voice = useVoice(lang, offline);           // server voice (Azure) first, the browser as fallback
  const [heard, setHeard] = useState<string | null>(null);      // what the farmer said, shown under the question
  const [notUnderstood, setNotUnderstood] = useState(false);

  // A returning farmer who taps "Go in" lands on Home; the questions are for new farmers or ?edit.
  useEffect(() => { if (profile && !edit) router.replace("/home"); }, [profile, edit, router]);

  const steps: { q: Key; body: React.ReactNode; pick?: boolean }[] = [
    { q: "qLocation", body: location() },
    { q: "qCrop", pick: true, body: <>
      <Pictures value={p.crop} onPick={(crop) => pick({ crop })}
        options={crops.map((c) => ({ id: c.id, icon: c.icon, label: cropName(lang, c.id) }))} />
      <input className="mt-3 min-h-[52px] w-full rounded-lg border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" value={crops.some((c) => c.id === p.crop) ? "" : p.crop}
        onChange={(e) => setP({ ...p, crop: e.target.value })} placeholder={t("otherCrop")} aria-label={t("otherCrop")} />
    </> },
    { q: "qPlanted", pick: true, body: <Pictures value={p.plantedOn} cols={2} onPick={(d) => pick({ plantedOn: d === "unknown" ? "" : d })}
        options={[...plantedChoices.map((c) => ({ id: weeksAgo(c.weeks), icon: c.icon, label: t(c.key) })), { id: "unknown", icon: "unknown", label: t("planted_unknown") }]} /> },
    { q: "qArea", body: area() },
    { q: "qIrrigation", pick: true, body: <Pictures value={p.irrigation} cols={2} onPick={(irrigation) => pick({ irrigation })}
        options={irrigations.map((c) => ({ id: c.id, icon: c.icon, label: t(c.key) }))} /> },
    { q: "qChallenge", pick: true, body: <Pictures value={p.challenge} cols={2} onPick={(challenge) => pick({ challenge: challenge as Profile["challenge"] })}
        options={challenges.map((c) => ({ id: c.id, icon: c.icon, label: t(c.key) }))} /> },
    // setup: where the moisture comes from, and how the phone connects (changeable later in Setup)
    { q: "qSensors", pick: true, body: <Pictures value={p.hasSensors ?? ""} cols={2} onPick={(v) => pick({ hasSensors: v as Profile["hasSensors"] })}
        options={[{ id: "none", icon: "field-sun", label: t("sensNone") }, { id: "shared", icon: "water", label: t("sensShared") }, { id: "own", icon: "drip", label: t("sensOwn") }]} /> },
    { q: "qConnection", pick: true, body: <><Pictures value={p.connection ?? ""} cols={2} onPick={(v) => pick({ connection: v as Profile["connection"] })}
        options={[{ id: "always", icon: "field-sun", label: t("connAlways") }, { id: "sometimes", icon: "unknown", label: t("connSometimes") }]} /><p className="mt-3 text-sm text-text-2">{t("connNote")}</p></> },
  ];
  const last = step === steps.length - 1;

  // Read each question aloud: the farmer doesn't have to read it. Azure when configured (Arabic and Darija included), else the browser.
  useEffect(() => { if (step >= 0) { setHeard(null); setNotUnderstood(false); voice.speak(t(steps[step].q)); } return () => voice.stopSpeaking(); }, [step, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // The farmer answers by voice: what was heard is matched to the pictures of the current question.
  const choicesFor = (i: number): Choice[] => {
    const L = (k: Key) => [tr("en", k), tr("fr", k), tr("ar", k), tr("ary", k)];
    if (i === 6) return [{ id: "none", labels: L("sensNone") }, { id: "shared", labels: L("sensShared") }, { id: "own", labels: L("sensOwn") }];
    if (i === 7) return [{ id: "always", labels: L("connAlways") }, { id: "sometimes", labels: L("connSometimes") }];
    if (i === 1) return crops.map((c) => ({ id: c.id, labels: [cropName("en", c.id), cropName("fr", c.id), cropName("ar", c.id), cropName("ary", c.id)] }));
    if (i === 2) return [...plantedChoices.map((c) => ({ id: weeksAgo(c.weeks), labels: L(c.key) })), { id: "unknown", labels: L("planted_unknown") }];
    if (i === 4) return irrigations.map((c) => ({ id: c.id, labels: L(c.key) }));
    if (i === 5) return challenges.map((c) => ({ id: c.id, labels: L(c.key) }));
    return [];
  };
  async function answerByVoice() {
    setNotUnderstood(false);
    const text = await voice.listen();
    if (!text) return;
    setHeard(text);
    if (step === 0) return setP({ ...p, location: text, lat: undefined, lon: undefined });
    if (step === 3) { const ha = parseArea(text); if (ha == null) return setNotUnderstood(true); return setP({ ...p, area: `${ha} ha` }); }
    const id = matchAnswer(text, choicesFor(step));
    if (!id) { if (step === 1) { setP({ ...p, crop: text }); return; } return setNotUnderstood(true); }
    if (step === 1) pick({ crop: id });
    else if (step === 2) pick({ plantedOn: id === "unknown" ? "" : id });
    else if (step === 4) pick({ irrigation: id });
    else if (step === 5) pick({ challenge: id as Profile["challenge"] });
    else if (step === 6) pick({ hasSensors: id as Profile["hasSensors"] });
    else pick({ connection: id as Profile["connection"] });
  }

  if (profile && !edit) return null;

  function next(np = p) {
    if (!last) return setStep(step + 1);
    saveProfile(np);
    // the answers go to the server too: crop, planting date and area feed the engine; queued when offline
    act({ type: "farmer", payload: { location: np.location || null, crop: np.crop || null, planted_on: np.plantedOn || null, area_ha: parseFloat(np.area) || null, irrigation: np.irrigation || null, challenge: np.challenge || null, lat: np.lat ?? null, lon: np.lon ?? null, lang, has_sensors: np.hasSensors ?? null, connection: np.connection ?? null, mode } });
    router.replace(mode === "simple" ? "/today" : "/home");
  }
  // Picture choices move on by themselves: one tap per question.
  function pick(patch: Partial<Profile>) {
    const np = { ...p, ...patch };
    setP(np);
    setTimeout(() => next(np), 250);
  }

  // Plain render functions, not components: a component defined in here would remount and drop input focus on every keystroke.
  function location() {
    function locate() {
      setLocating("busy");
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude: lat, longitude: lon } }) => {
          const location = await townAt(lat, lon, lang).catch(() => `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
          setP((x) => ({ ...x, location, lat, lon }));
          setLocating("");
        },
        () => setLocating("failed"),
        { timeout: 15000 },
      );
    }
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="lg" full icon="pin" loading={locating === "busy"} onClick={locate}>{locating === "busy" ? t("locating") : t("useLocation")}</Button>
        {p.location && p.lat !== undefined && <p className="flex items-center justify-center gap-2 text-xl font-medium"><Icon name="pin" className="h-6 w-6 text-brand" />{p.location}<Icon name="check" className="h-6 w-6 text-brand" /></p>}
        {locating === "failed" && <p role="alert" className="text-sm text-danger">{t("locationFailed")}</p>}
        <input className="min-h-[52px] w-full rounded-lg border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" value={p.lat === undefined ? p.location : ""} placeholder={t("typeTown")} aria-label={t("typeTown")}
          onChange={(e) => setP({ ...p, location: e.target.value, lat: undefined, lon: undefined })} />
      </div>
    );
  }

  function area() {
    const n = parseFloat(p.area) || 0;
    const setN = (v: number) => setP({ ...p, area: v > 0 ? `${Math.round(v * 100) / 100} ha` : "" });
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <Button variant="secondary" size="lg" icon="minus" iconOnly disabled={n <= 0.5} onClick={() => setN(Math.max(0.5, (n || 1) - 0.5))}>{t("less")}</Button>
          <div className="text-center">
            <div className="font-display num text-6xl">{n ? n.toLocaleString(lang === "ar" || lang === "ary" ? "ar-MA-u-nu-latn" : lang) : "–"}</div>
            <div className="text-lg text-text-2">{t("hectares")}</div>
          </div>
          <Button variant="secondary" size="lg" icon="plus" iconOnly onClick={() => setN((n || 0.5) + 0.5)}>{t("more")}</Button>
        </div>
        {/* exact value typed by hand, for a farmer who knows his surface (e.g. 2.37 ha) */}
        <FormField label={t("areaExact")} unit={t("hectares")} hint={t("areaHint")} type="number" inputMode="decimal" step="0.01" min="0.01" max="10000"
          value={n ? String(n) : ""} placeholder={t("eg", { v: "2.37" })} onChange={(e) => setN(parseFloat(e.target.value.replace(",", ".")) || 0)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon="chev" iconOnly className="-ms-2 [&_svg]:-scale-x-100 rtl:[&_svg]:scale-x-100" onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>{t("back")}</Button>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={`${step + 1} / ${steps.length}`}>
          {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-line"}`} />)}
        </div>
        <span className="num text-xs text-text-3">{step + 1}/{steps.length}</span>
        <Button variant="ghost" size="sm" onClick={() => router.replace("/home")}>{t("skipToHome")}</Button>
      </div>
      <form key={step} className="anim-fade-up mt-6 flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="flex items-start gap-3">
          <h1 className="font-display flex-1 text-3xl leading-tight">{t(steps[step].q)}</h1>
          <Button variant="secondary" size="sm" icon="speaker" iconOnly onClick={() => voice.speak(t(steps[step].q))}>{t("listen")}</Button>
        </div>
        {voice.hasVoice && !offline && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
            <button type="button" onClick={voice.state === "listening" ? voice.stopListening : answerByVoice} disabled={voice.state === "speaking"} aria-label={voice.state === "listening" ? t("stop") : t("answerByVoice")}
              className={`pressable grid h-14 w-14 flex-none place-items-center rounded-full transition-[background-color,box-shadow] disabled:opacity-50 ${voice.state === "listening" ? "bg-danger text-white" : "bg-accent text-on-accent"}`}
              style={voice.state === "listening" ? { boxShadow: `0 0 0 ${4 + Math.round(voice.level * 12)}px rgb(178 58 42 / .25)` } : undefined}>
              <UiIcon name={voice.state === "listening" ? "stop" : "mic"} size={26} />
            </button>
            <div className="min-w-0 flex-1 text-sm">
              <b className="block">{voice.state === "listening" ? t("stListening") : t("answerByVoice")}</b>
              <span className={`block truncate ${notUnderstood ? "text-danger" : "text-text-2"}`}>{voice.message ? t(voice.message as Key) : notUnderstood ? t("notUnderstood") : heard ? `“${heard}”` : t("answerHint")}</span>
            </div>
          </div>
        )}
        <div className="mt-5">{steps[step].body}</div>
        <div className="mt-auto flex items-center gap-3 pt-8">
          <Button variant="ghost" onClick={() => next()}>{t("skip")}</Button>
          {!steps[step].pick && <Button type="submit" variant="accent" size="lg" className="flex-1" iconEnd={last ? "check" : "chev"}>{last ? t("start") : t("next")}</Button>}
        </div>
      </form>
    </div>
  );
}

function Pictures({ options, value, onPick, cols = 4 }: { options: { id: string; icon: string; label: string }[]; value: string; onPick: (id: string) => void; cols?: 2 | 4 }) {
  return (
    <div className={`grid gap-2 ${cols === 4 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2"}`}>
      {options.map((o) => (
        <button key={o.label} type="button" onClick={() => onPick(o.id)} aria-pressed={value === o.id}
          className={`pressable flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-sm font-semibold transition-colors ${value === o.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-text hover:bg-surface-2"}`}>
          <Icon name={o.icon} className="h-9 w-9 text-brand" />
          <span className="leading-tight">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  return <Suspense><Onboarding /></Suspense>;
}
