"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { API, get } from "@/lib/api";
import { useFarm, useT, type Profile } from "@/lib/farm";
import { challenges, cropName, crops, irrigations, langs, plantedChoices, tr, type Key } from "@/lib/i18n";
import { Icon } from "@/lib/icons";
import { speak } from "@/lib/voice";

const blank: Profile = { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" };
const weeksAgo = (w: number) => new Date(Date.now() - w * 7 * 864e5).toISOString().slice(0, 10);

// Name of the town at a position. With a backend it asks our server (the position goes from there, not from the phone, to the
// place-name service); without one it asks the service directly. Never waits long: after 6 s the coordinates are shown instead.
async function townAt(lat: number, lon: number, lang: string) {
  if (API) {
    const r = await get<{ place: string | null }>(`/geo/place?lat=${lat}&lon=${lon}&lang=${lang}`, 6000);
    if (r.place) return r.place;
  } else {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`, { signal: AbortSignal.timeout(6000) }).then((x) => x.json());
    const name = r.city || r.locality || r.principalSubdivision;
    if (name) return name as string;
  }
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

// A field needs a good fix: ask for the GPS first, and if it does not answer in time (indoors) accept a rough position.
// A refusal by the farmer is final: no second try.
const askPosition = (opts: PositionOptions) => new Promise<GeolocationPosition>((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, opts));
async function position() {
  try {
    return await askPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  } catch (e) {
    if ((e as GeolocationPositionError).code === 1) throw e;
    return askPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }
}

function Onboarding() {
  const { profile, saveProfile, lang, setLang } = useFarm();
  const t = useT();
  const router = useRouter();
  const [p, setP] = useState<Profile>(profile ?? blank);
  const edit = useSearchParams().has("edit");
  const [step, setStep] = useState(edit ? 0 : -1); // -1 = welcome screen
  const [locating, setLocating] = useState<"" | "busy" | "failed" | "denied">("");

  // Returning farmers land on My Farm; the welcome + questions are for new users or ?edit.
  useEffect(() => { if (profile && !edit) router.replace("/farm"); }, [profile, edit, router]);

  const steps: { q: Key; body: React.ReactNode; pick?: boolean }[] = [
    { q: "qLocation", body: location() },
    { q: "qCrop", pick: true, body: <>
      <Pictures value={p.crop} onPick={(crop) => pick({ crop })}
        options={crops.map((c) => ({ id: c.id, icon: c.icon, label: cropName(lang, c.id) }))} />
      <input className="field mt-3" value={crops.some((c) => c.id === p.crop) ? "" : p.crop}
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
    router.replace("/farm");
  }
  // Picture choices move on by themselves: one tap per question.
  function pick(patch: Partial<Profile>) {
    const np = { ...p, ...patch };
    setP(np);
    setTimeout(() => next(np), 250);
  }

  // Plain render functions, not components: a component defined in here would remount and drop input focus on every keystroke.
  function location() {
    async function locate() {
      if (!("geolocation" in navigator)) return setLocating("failed"); // some in-app browsers have none: say so instead of waiting forever
      setLocating("busy");
      try {
        const { coords: { latitude: lat, longitude: lon } } = await position();
        const location = await townAt(lat, lon, lang).catch(() => `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
        setP((x) => ({ ...x, location, lat, lon }));
        setLocating("");
      } catch (e) {
        setLocating((e as GeolocationPositionError).code === 1 ? "denied" : "failed");
      }
    }
    return (
      <div className="space-y-4">
        <button type="button" onClick={locate} disabled={locating === "busy"} className="btn flex w-full items-center justify-center gap-3 py-5 text-lg">
          <Icon name="pin" />{locating === "busy" ? t("locating") : t("useLocation")}
        </button>
        {p.location && p.lat !== undefined && <p className="flex items-center justify-center gap-2 text-xl font-medium"><Icon name="pin" className="h-6 w-6 text-leaf" />{p.location}<Icon name="check" className="h-6 w-6 text-leaf" /></p>}
        {(locating === "failed" || locating === "denied") && <p role="alert" className="text-sun">{t(locating === "denied" ? "locationDenied" : "locationFailed")}</p>}
        <input className="field" value={p.lat === undefined ? p.location : ""} placeholder={t("typeTown")} aria-label={t("typeTown")}
          onChange={(e) => setP({ ...p, location: e.target.value, lat: undefined, lon: undefined })} />
      </div>
    );
  }

  function area() {
    const n = parseFloat(p.area) || 1;
    const setN = (v: number) => setP({ ...p, area: `${Math.max(0.5, v)} ha` });
    return (
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => setN(n - 0.5)} aria-label={t("less")} className="btn-ghost h-20 w-20 text-4xl">−</button>
        <div className="text-center">
          <div className="font-serif text-6xl">{n}</div>
          <div className="text-lg text-muted">{t("hectares")}</div>
        </div>
        <button type="button" onClick={() => setN(n + 0.5)} aria-label={t("more")} className="btn-ghost h-20 w-20 text-4xl">+</button>
      </div>
    );
  }

  if (step < 0) return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-12">
      <div role="group" aria-label={t("chooseLang")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {langs.map((l) => (
          <button key={l.id} type="button" aria-pressed={lang === l.id}
            onClick={() => { setLang(l.id); speak(tr(l.id, "headline"), l.id); }}
            className={`rounded-xl border py-3 text-lg ${lang === l.id ? "border-leaf bg-leaf-soft font-semibold text-leaf" : "border-line bg-card"}`}>
            {l.name}
          </button>
        ))}
      </div>
      <img src="/images/field-drip.webp" alt="" width={960} height={640} className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover" />
      <h1 className="mt-8 font-serif text-4xl leading-tight md:text-5xl">{t("headline")}</h1>
      <ul className="mt-8 space-y-4 text-lg">
        <li className="flex items-center gap-4"><Feature name="mic" />{t("feat1")}</li>
        <li className="flex items-center gap-4"><Feature name="field-sun" />{t("feat2")}</li>
        <li className="flex items-center gap-4"><Feature name="growth-time" />{t("feat3")}</li>
      </ul>
      <div className="mt-auto pt-10 md:mt-12">
        <button className="btn w-full py-4 text-lg" onClick={() => setStep(0)}>{t("getStarted")}</button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-10">
      <div className="mt-2 flex gap-1.5" aria-label={`${step + 1} / ${steps.length}`}>
        {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-leaf" : "bg-line"}`} />)}
      </div>
      <form className="mt-8 flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="flex items-start gap-3">
          <h1 className="flex-1 font-serif text-3xl leading-tight">{t(steps[step].q)}</h1>
          <button type="button" onClick={() => speak(t(steps[step].q), lang)} aria-label={t("listen")}
            className="shrink-0 rounded-full bg-leaf-soft p-3 text-leaf"><Icon name="speaker" /></button>
        </div>
        <div className="mt-6">{steps[step].body}</div>
        <div className="mt-auto flex gap-3 pt-10">
          <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>{t("back")}</button>
          <button type="button" className="btn-ghost flex-1 text-muted" onClick={() => next()}>{t("skip")}</button>
          {!steps[step].pick && <button className="btn flex-1">{last ? t("start") : t("next")}</button>}
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
          className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-4 text-center ${value === o.id ? "border-leaf bg-leaf-soft font-semibold text-leaf" : "border-line bg-card"}`}>
          <Icon name={o.icon} className="h-9 w-9 text-leaf" />
          <span className="leading-tight">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Feature({ name }: { name: string }) {
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf"><Icon name={name} /></span>;
}

export default function Page() {
  return <Suspense><Onboarding /></Suspense>;
}
