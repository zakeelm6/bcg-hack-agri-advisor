"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFarm, type Profile } from "@/lib/farm";

const blank: Profile = { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" };

function Onboarding() {
  const { profile, saveProfile } = useFarm();
  const router = useRouter();
  const [p, setP] = useState<Profile>(profile ?? blank);
  const edit = useSearchParams().has("edit");
  const [step, setStep] = useState(edit ? 0 : -1); // -1 = welcome screen
  // Returning farmers land on My Farm; the welcome + questions are for new users or ?edit.
  useEffect(() => { if (profile && !edit) router.replace("/farm"); }, [profile, edit, router]);
  if (profile && !edit) return null;
  const set = (k: keyof Profile) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value });
  const choice = (k: keyof Profile, options: string[]) => (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => setP({ ...p, [k]: o })}
          className={`rounded-xl border px-3 py-3.5 text-left capitalize ${p[k] === o ? "border-leaf bg-leaf-soft font-medium text-leaf" : "border-line bg-card"}`}>
          {o}
        </button>
      ))}
    </div>
  );

  const steps = [
    { q: "Where is your farm?", hint: "Town or region is enough. Used for weather.",
      body: <input className="field" autoFocus value={p.location} onChange={set("location")} placeholder="e.g. Meknes, Morocco" /> },
    { q: "What's your main crop?", hint: "And when you planted it, if you know.",
      body: <div className="space-y-3">
        <input className="field" autoFocus value={p.crop} onChange={set("crop")} placeholder="e.g. Tomatoes" />
        <label className="block"><span className="label">Planted on</span>
          <input className="field mt-1" type="date" max={new Date().toISOString().slice(0, 10)} value={p.plantedOn} onChange={set("plantedOn")} /></label>
      </div> },
    { q: "How big is the field?", hint: "Any unit you use.",
      body: <input className="field" autoFocus value={p.area} onChange={set("area")} placeholder="e.g. 2 hectares" /> },
    { q: "How do you irrigate?", hint: "",
      body: choice("irrigation", ["drip", "sprinkler", "flood / furrow", "rain-fed"]) },
    { q: "What's your biggest challenge right now?", hint: "I'll focus my advice on this.",
      body: choice("challenge", ["water", "crop health", "costs", "yield"]) },
  ];
  const last = step === steps.length - 1;
  const next = () => {
    if (!last) return setStep(step + 1);
    saveProfile(p);
    router.replace("/farm");
  };

  if (step < 0) return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-16">
      <p className="label mt-6">Your AI farming co-pilot</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Better decisions for your farm, every day.</h1>
      <ul className="mt-6 space-y-2 text-muted">
        <li>✓ Ask by text, voice or photo</li>
        <li>✓ Advice based on your crop, field and weather</li>
        <li>✓ Turn advice into tasks and track what you did</li>
      </ul>
      <p className="mt-6 text-sm text-muted">5 quick questions · about a minute</p>
      <div className="mt-auto flex flex-col gap-3 pt-10 md:mt-10 md:flex-row">
        <button className="btn flex-1" onClick={() => setStep(0)}>Get started</button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[75dvh] w-full max-w-lg flex-col md:min-h-0 md:pt-10">
      <div className="mt-2 flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-leaf" : "bg-line"}`} />)}
      </div>
      <form className="mt-10 flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <h1 className="font-serif text-3xl leading-tight">{steps[step].q}</h1>
        {steps[step].hint && <p className="mt-2 text-muted">{steps[step].hint}</p>}
        <div className="mt-6">{steps[step].body}</div>
        <div className="mt-auto flex gap-3 pt-10">
          <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button>
          <button type="button" className="btn-ghost flex-1 text-muted" onClick={next}>Skip</button>
          <button className="btn flex-1">{last ? "Start" : "Next"}</button>
        </div>
      </form>
    </div>
  );
}

export default function Page() {
  return <Suspense><Onboarding /></Suspense>;
}
