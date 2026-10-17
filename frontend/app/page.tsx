"use client";
// Landing page: what Farm Advisor is, how it works, the AI inside, what is real in the demo, about the team. One action: Go in.
// A returning farmer goes straight to Home; a new one answers the questions about the field first (/start).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Icon } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";
import { useFarm, useT } from "@/lib/farm";
import { langs } from "@/lib/i18n";
import { LANG_NATIVE } from "@/components/LangControl";

const STEPS = [["lp1t", "lp1d", "mic"], ["lp2t", "lp2d", "satellite"], ["lp3t", "lp3d", "check"], ["lp4t", "lp4d", "camera"]] as const;
const AI = [["ai1t", "ai1d", "shield"], ["ai2t", "ai2d", "refresh"], ["ai3t", "ai3d", "sensor"], ["ai4t", "ai4d", "chat"]] as const;

export default function Landing() {
  const t = useT();
  const { profile, lang, setLang, mode } = useFarm();
  const router = useRouter();
  const goIn = () => router.push(profile ? (mode === "simple" ? "/today" : "/home") : "/start");
  return (
    <div className="mx-auto max-w-5xl">
      {/* hero */}
      <section className="anim-fade-up grid items-center gap-6 md:grid-cols-2 md:gap-10">
        <div className="relative overflow-hidden rounded-2xl md:order-2">
          <img src="/images/field-drip.webp" alt="" width={960} height={640} className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
            <Badge className="!bg-black/55 !text-white" icon="satellite">Sentinel-2</Badge><Badge className="!bg-black/55 !text-white" icon="cloud">Open-Meteo</Badge><Badge className="!bg-black/55 !text-white" icon="mic">Azure Speech</Badge>
          </div>
        </div>
        <div className="md:order-1">
          <p className="mb-4 flex items-center gap-3 font-display text-2xl text-brand"><Logo size={48} />{t("appName")}</p>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{t("headline")}</h1>
          <p className="mt-4 text-lg text-text-2">{t("landingSub")}</p>
          <div role="group" aria-label={t("chooseLang")} className="mt-5 flex flex-wrap gap-2">
            {langs.map((l) => <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`pressable min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${lang === l.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>{LANG_NATIVE[l.id]}</button>)}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="accent" size="lg" iconEnd="chev" onClick={goIn} className="sm:min-w-56">{t("goIn")}</Button>
            {!profile && <Button variant="ghost" href="/today">{t("seeDemo")}</Button>}
          </div>
          <p className="mt-2 text-sm text-text-3">{profile ? t("profileNote") : t("landingNote")}</p>
        </div>
      </section>

      {/* how it works */}
      <section className="mt-14" aria-labelledby="how">
        <h2 id="how" className="font-display mb-4 text-2xl md:text-3xl">{t("howItWorks")}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, desc, icon], i) => (
            <li key={title}><Card className="h-full">
              <div className="flex items-center gap-3"><span className="num grid h-9 w-9 place-items-center rounded-full bg-brand-strong text-sm font-bold text-on-brand">{i + 1}</span><Icon name={icon} size={22} className="text-brand" /></div>
              <h3 className="mt-3 text-lg font-semibold leading-tight">{t(title)}</h3>
              <p className="mt-1.5 text-sm text-text-2">{t(desc)}</p>
            </Card></li>
          ))}
        </ol>
      </section>

      {/* the AI inside */}
      <section className="mt-12" aria-labelledby="ai">
        <h2 id="ai" className="font-display mb-4 text-2xl md:text-3xl">{t("aiInside")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {AI.map(([title, desc, icon]) => (
            <Card key={title} tone="inset" className="flex gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-surface text-brand"><Icon name={icon} size={24} /></span>
              <div><h3 className="text-lg font-semibold leading-tight">{t(title)}</h3><p className="mt-1.5 text-sm text-text-2">{t(desc)}</p></div>
            </Card>
          ))}
        </div>
      </section>

      {/* honesty + about */}
      <section id="about" className="mt-12 grid gap-3 md:grid-cols-2" aria-labelledby="about-h">
        <Card>
          <h2 className="font-display text-xl">{t("whatIsReal")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Badge tone="success" icon="check" className="me-1.5">{t("realLabel").replace(":", "")}</Badge>{t("realList")}</li>
            <li><Badge tone="simulated" icon="sensor" className="me-1.5">{t("simLabel").replace(":", "")}</Badge>{t("simList")}</li>
            <li><Badge tone="warning" icon="warning" className="me-1.5">{t("notValidLabel").replace(":", "")}</Badge>{t("notValidList")}</li>
          </ul>
        </Card>
        <Card>
          <h2 id="about-h" className="font-display text-xl">{t("aboutTitle")}</h2>
          <p className="mt-3 text-sm text-text-2">{t("aboutText")}</p>
          <p className="mt-3 text-xs text-text-3">{t("darijaNote")}</p>
          <p className="mt-4 text-xs text-text-3">Sanabils · Team 2 · BCG Platinion Hackathon 2026 · <Link href="/home" className="underline">{t("seeDemo")}</Link></p>
        </Card>
      </section>

      <div className="sticky bottom-[max(12px,env(safe-area-inset-bottom))] mt-10 md:static md:mt-12 md:flex md:justify-center">
        <Button variant="accent" size="lg" full iconEnd="chev" onClick={goIn} className="shadow-3 md:mx-auto md:w-auto md:min-w-72">{t("goIn")}</Button>
      </div>
    </div>
  );
}
