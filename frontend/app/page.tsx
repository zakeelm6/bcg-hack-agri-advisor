"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFarm, useT, type Profile } from "@/lib/farm";
import { useActions } from "@/lib/data";
import { challenges, cropName, crops, irrigations, langs, plantedChoices, tr, type Key } from "@/lib/i18n";
import { Icon } from "@/lib/icons";
import { speak } from "@/lib/voice";
import { Button } from "@/components/ui";

const blank: Profile = { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" };
const weeksAgo = (w: number) => new Date(Date.now() - w * 7 * 864e5).toISOString().slice(0, 10);

// Reverse-geocodes GPS to a town name (BigDataCloud client endpoint: free, keyless, only called when the farmer taps the button).
async function townAt(lat: number, lon: number, lang: string) {
  const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`).then((x) => x.json());
  return r.city || r.locality || r.principalSubdivision || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function Onboarding() {
  const { profile, saveProfile, lang, setLang } = useFarm();
  const { act } = useActions();
  const t = useT();
  const router = useRouter();
  const [p, setP] = useState<Profile>(profile ?? blank);
  const edit = useSearchParams().has("edit");
  const [step, setStep] = useState(edit ? 0 : -1); // -1 = welcome screen
  const [locating, setLocating] = useState<"" | "busy" | "failed">("");

  // Returning farmers land on My Farm; the welcome + questions are for new users or ?edit.
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
  ];
  const last = step === steps.length - 1;

  // Read each question aloud: the farmer doesn't have to read it.
  useEffect(() => { if (step >= 0) speak(t(steps[step].q), lang); }, [step, lang]);

  if (profile && !edit) return null;

  function next(np = p) {
    if (!last) return setStep(step + 1);
    saveProfile(np);
    // the answers go to the server too: crop, planting date and area feed the engine; queued when offline
    act({ type: "farmer", payload: { location: np.location || null, crop: np.crop || null, planted_on: np.plantedOn || null, area_ha: parseFloat(np.area) || null, irrigation: np.irrigation || null, challenge: np.challenge || null, lat: np.lat ?? null, lon: np.lon ?? null, lang } });
    router.replace("/home");
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
    const n = parseFloat(p.area) || 1;
    const setN = (v: number) => setP({ ...p, area: `${Math.max(0.5, v)} ha` });
    return (
      <div className="flex items-center justify-between gap-4">
        <Button variant="secondary" size="lg" icon="minus" iconOnly onClick={() => setN(n - 0.5)}>{t("less")}</Button>
        <div className="text-center">
          <div className="font-display num text-6xl">{n}</div>
          <div className="text-lg text-text-2">{t("hectares")}</div>
        </div>
        <Button variant="secondary" size="lg" icon="plus" iconOnly onClick={() => setN(n + 0.5)}>{t("more")}</Button>
      </div>
    );
  }

  if (step < 0) return (
    <div className="anim-fade-up mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-8">
      <div className="relative overflow-hidden rounded-2xl">
        <img src="/images/field-drip.webp" alt="" width={960} height={640} className="aspect-[16/10] w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-neutral-900/10 to-transparent" aria-hidden />
        <h1 className="font-display absolute inset-x-5 bottom-5 text-3xl leading-tight text-white md:text-4xl">{t("headline")}</h1>
      </div>
      <ul className="mt-6 space-y-3 text-base">
        <li className="flex items-center gap-3"><Feature name="mic" />{t("feat1")}</li>
        <li className="flex items-center gap-3"><Feature name="field-sun" />{t("feat2")}</li>
        <li className="flex items-center gap-3"><Feature name="growth-time" />{t("feat3")}</li>
      </ul>
      <div role="group" aria-label={t("chooseLang")} className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {langs.map((l) => (
          <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => { setLang(l.id); speak(tr(l.id, "headline"), l.id); }}
            className={`pressable min-h-12 rounded-lg border text-base font-semibold transition-colors ${lang === l.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>{l.name}</button>
        ))}
      </div>
      <div className="mt-auto space-y-2 pt-8">
        <Button variant="accent" size="lg" full iconEnd="chev" onClick={() => setStep(0)}>{t("getStarted")}</Button>
        <Button variant="ghost" full onClick={() => router.replace("/home")}>{t("skipToHome")}</Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon="chev" iconOnly className="-ms-2 [&_svg]:-scale-x-100 rtl:[&_svg]:scale-x-100" onClick={() => setStep(step - 1)}>{t("back")}</Button>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={`${step + 1} / ${steps.length}`}>
          {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-line"}`} />)}
        </div>
        <span className="num text-xs text-text-3">{step + 1}/{steps.length}</span>
      </div>
      <form key={step} className="anim-fade-up mt-6 flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="flex items-start gap-3">
          <h1 className="font-display flex-1 text-3xl leading-tight">{t(steps[step].q)}</h1>
          <Button variant="secondary" size="sm" icon="speaker" iconOnly onClick={() => speak(t(steps[step].q), lang)}>{t("listen")}</Button>
        </div>
        <div className="mt-6">{steps[step].body}</div>
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

function Feature({ name }: { name: string }) {
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name={name} /></span>;
}

export default function Page() {
  return <Suspense><Onboarding /></Suspense>;
}
