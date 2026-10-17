"use client";
// The living design system page (development only): every token, type style and component in every state, in the current
// language and theme. Switch language with the header control; theme and contrast with the toggles at the top.
import { notFound } from "next/navigation";
import { useState } from "react";
import { Badge, Banner, Button, Card, ConfidenceMeter, EmptyState, FormField, Icon, ICONS, Label, ListItem, Segmented, Sheet, Skeleton, SkeletonCard, Stat, Tooltip, useToast } from "@/components/ui";
import { useFarm, useT } from "@/lib/farm";
import { useTheme } from "@/lib/theme";

const SWATCHES = ["bg", "surface", "surface-2", "surface-3", "line", "line-strong", "text", "text-2", "text-3", "brand", "brand-strong", "brand-soft", "accent", "accent-strong", "accent-soft", "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft", "simulated"];

export default function Design() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SHOW_DESIGN !== "1") notFound();
  return <DesignPage />;
}

function DesignPage() {
  const t = useT();
  const { lang } = useFarm();
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const toast = useToast();
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [sheet, setSheet] = useState(false);
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display mb-4 mt-12 text-2xl first:mt-0">{children}</h2>;
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">Design system</h1>
        <Badge tone="outline">{lang}</Badge>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <Segmented label={t("theme")} size="sm" value={theme} onChange={setTheme} options={[{ id: "auto", label: t("themeAuto") }, { id: "light", label: t("themeLight"), icon: "sun" }, { id: "dark", label: t("themeDark"), icon: "moon" }]} />
          <Button size="sm" variant={contrast ? "primary" : "secondary"} icon="contrast" aria-pressed={contrast} onClick={() => setContrast(!contrast)}>{t("highContrast")}</Button>
        </span>
      </div>

      <H>Colour</H>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {SWATCHES.map((n) => <div key={n} className="overflow-hidden rounded-lg border border-line"><div className="h-14" style={{ background: `var(--color-${n})` }} /><div className="num bg-surface px-2 py-1 text-xs text-text-2">{n}</div></div>)}
      </div>

      <H>Type</H>
      <Card>
        <p className="font-display text-4xl">{t("headline")}</p>
        <p className="font-display mt-3 text-2xl">{t("doThisNow")} · {t("navField")} · {t("navTasks")}</p>
        <p className="mt-3 text-lg">{t("noTaskToday")}</p>
        <p className="mt-2 text-base text-text-2">{t("profileNote")}</p>
        <p className="mt-2 text-sm text-text-3">{t("footer")}</p>
        <p className="num mt-3 text-3xl">25 mm · 0.62 · 154 000 MAD · 3,20</p>
      </Card>

      <H>Buttons</H>
      <Card className="space-y-4">
        {(["accent", "primary", "secondary", "ghost", "danger"] as const).map((v) => (
          <div key={v} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-xs text-text-3">{v}</span>
            <Button variant={v} size="sm" icon="check">{t("done")}</Button>
            <Button variant={v} icon="check">{t("done")}</Button>
            <Button variant={v} size="lg" icon="check" iconEnd="chev">{t("done")}</Button>
            <Button variant={v} loading>{t("save")}</Button>
            <Button variant={v} disabled>{t("save")}</Button>
            <Button variant={v} icon="mic" iconOnly>{t("speak")}</Button>
          </div>
        ))}
      </Card>

      <H>Badges and confidence</H>
      <Card className="flex flex-wrap items-center gap-3">
        <Badge>neutral</Badge><Badge tone="brand" icon="leaf">brand</Badge><Badge tone="accent">accent</Badge><Badge tone="success" icon="check">{t("done")}</Badge><Badge tone="warning" icon="warning">warning</Badge><Badge tone="danger">danger</Badge><Badge tone="info" icon="info">info</Badge><Badge tone="simulated" icon="sensor">{t("sensorsSim")}</Badge><Badge tone="outline" size="md">{t("demo")}</Badge>
        <span className="basis-full" />
        <ConfidenceMeter conf="High" /><ConfidenceMeter conf="Medium" /><ConfidenceMeter conf="Low" /><ConfidenceMeter conf="Medium" size="sm" />
      </Card>

      <H>Segmented, tooltip, toast, sheet</H>
      <Card className="flex flex-wrap items-center gap-3">
        <Segmented label="demo" value={seg} onChange={setSeg} options={[{ id: "a", label: t("layerVigor"), icon: "leaf" }, { id: "b", label: t("layerMoisture"), icon: "drop" }, { id: "c", label: t("layerSoil"), icon: "flask", dot: true }]} />
        <Tooltip text={t("confFor", { t: "…", c: t("confMedium"), r: "" })}><Button size="sm" variant="ghost" icon="info">tooltip</Button></Tooltip>
        <Button size="sm" onClick={() => toast(t("savedThanks"), undefined, "check")}>toast</Button>
        <Button size="sm" onClick={() => toast(t("done"), { label: t("undo"), fn: () => {} }, "check")}>toast + undo</Button>
        <Button size="sm" onClick={() => setSheet(true)}>sheet</Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} title={t("chooseLang")} closeLabel={t("close")}><p className="text-text-2">{t("darijaNote")}</p><div className="h-4" /><Button full variant="primary" onClick={() => setSheet(false)}>{t("close")}</Button></Sheet>
      </Card>

      <H>Banners</H>
      <div className="space-y-3">
        <Banner tone="info" icon="cloudoff" title={t("offline")}>{t("offlineAdvice", { age: t("minAgo", { n: 12 }) })}</Banner>
        <Banner tone="warning" title={t("notValidated")}>{t("cropUnknown")}</Banner>
        <Banner tone="danger" title={t("sensorBad")} action={<Button size="sm" variant="secondary">{t("addSoilTest")}</Button>} />
        <Banner tone="success" title={t("synced")} />
      </div>

      <H>List items, stats, cards</H>
      <div className="grid gap-3 md:grid-cols-2">
        <ListItem icon="drop" iconTone="accent" title="Irrigate Zone D, 25 mm" sub={t("today") + " 07:00"} meta={<ConfidenceMeter conf="Medium" size="sm" />} chevron href="#" />
        <ListItem icon="search" title="Inspect zone D" sub={t("today")} end={<Badge tone="success" icon="check">{t("done")}</Badge>} muted />
        <Card><Label end={<Badge tone="outline">{t("demo")}</Badge>}>{t("harvest")}</Label><Stat value="43.2 – 52.8" unit="t" label={t("notValidated")} className="mt-2" /></Card>
        <Card tone="accent"><Label className="text-current opacity-80">{t("doThisNow")}</Label><div className="font-display mt-1 text-2xl">Irrigate Zone D, 25 mm</div></Card>
        <Card tone="brand"><div className="font-display text-xl">{t("allGood")}</div><div className="mt-1 text-sm opacity-90">{t("noTaskToday")}</div></Card>
        <Card tone="inset"><Label>{t("weather")}</Label><div className="num mt-2 text-xl">30° · 0 mm</div></Card>
      </div>

      <H>Form, skeletons, empty state</H>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-3"><FormField label="pH" hint={t("range", { a: 3, b: 10 })} placeholder={t("eg", { v: "6.4" })} type="number" inputMode="decimal" /><FormField label={t("moisturePct")} unit="%" hint={t("range", { a: 3, b: 60 })} error={t("moRange")} defaultValue="80" type="number" /></Card>
        <div className="space-y-3"><SkeletonCard /><Skeleton className="h-24" /><EmptyState icon="check" tone="success" title={t("allGood")} action={<Button size="sm" variant="secondary" icon="tasks">{t("seeTasks")}</Button>}>{t("noTaskToday")}</EmptyState></div>
      </div>

      <H>Icons</H>
      <Card className="grid grid-cols-6 gap-3 sm:grid-cols-10 md:grid-cols-14">
        {Object.keys(ICONS).map((n) => <div key={n} className="flex flex-col items-center gap-1 text-text-2"><Icon name={n} /><span className="num text-[10px]">{n}</span></div>)}
      </Card>
    </div>
  );
}
