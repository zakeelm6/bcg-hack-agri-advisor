"use client";
// Setup: where the moisture comes from (sensors or not), how the phone connects, the advisor's number, how the app looks.
// Saved on the phone and sent to the engine (queued when offline). "Keep for offline" stores every screen's data now.
import { useState } from "react";
import { PageTitle } from "@/components/common";
import { Button, Card, Icon, Label, Segmented, useToast } from "@/components/ui";
import { cachedGet } from "@/lib/api";
import { useActions, useAppState } from "@/lib/data";
import { useFarm, useT, type Mode, type Profile } from "@/lib/farm";

const blank: Profile = { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" };

export default function Setup() {
  const t = useT();
  const { profile, saveProfile, mode, setMode, lang } = useFarm();
  const { act } = useActions();
  const { data: s } = useAppState();
  const toast = useToast();
  const [phone, setPhone] = useState(profile?.advisorPhone ?? "");
  const [keeping, setKeeping] = useState(false);
  const p = profile ?? blank;
  const save = (patch: Partial<Profile>) => {
    const np = { ...p, ...patch }; saveProfile(np);
    act({ type: "farmer", payload: { has_sensors: np.hasSensors ?? null, connection: np.connection ?? null, advisor_phone: np.advisorPhone || null, mode } });
  };
  const Pick = <T extends string>({ value, options, onPick }: { value?: T; options: { id: T; label: string; icon: string }[]; onPick: (v: T) => void }) => (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onPick(o.id)} className={`pressable flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-3 text-center text-base font-semibold transition-colors ${value === o.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}><Icon name={o.icon} size={28} /><span className="leading-tight">{o.label}</span></button>)}
    </div>
  );
  const keepOffline = async () => {
    setKeeping(true);
    await Promise.allSettled(["/api/state", "/api/forecast", "/api/season", "/api/briefing", "/api/zones/anomalies", "/api/ndvi-series", "/api/farmer"].map((u) => cachedGet(`${u}?lang=${lang}`)).concat([cachedGet("/api/offers"), cachedGet("/static/land.json")]));
    setKeeping(false); toast(t("keptOffline"), undefined, "check");
  };
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={t("setup")} back={mode === "simple" ? "/today" : "/me"} />
      <div className="space-y-3">
        <Card><Label>{t("qSensors")}</Label><div className="mt-3"><Pick value={p.hasSensors} onPick={(v) => save({ hasSensors: v })} options={[{ id: "none", label: t("sensNone"), icon: "satellite" }, { id: "shared", label: t("sensShared"), icon: "sensor" }, { id: "own", label: t("sensOwn"), icon: "sensor" }]} /></div>
          {p.hasSensors === "none" && <p className="mt-3 text-sm text-text-2">{t("noSensorsNote")}</p>}
          {s && (s.data_notes as { sensors?: string }).sensors === "simulated" && p.hasSensors !== "none" && <p className="mt-3 text-xs text-text-3">{t("sensorsSim")}</p>}
        </Card>
        <Card><Label>{t("qConnection")}</Label><div className="mt-3"><Pick value={p.connection} onPick={(v) => save({ connection: v })} options={[{ id: "always", label: t("connAlways"), icon: "cloud" }, { id: "sometimes", label: t("connSometimes"), icon: "cloudoff" }]} /></div>
          <p className="mt-3 text-sm text-text-2">{t("connNote")}</p>
          <Button variant="secondary" icon="refresh" className="mt-3" loading={keeping} onClick={keepOffline}>{t("keepOffline")}</Button>
        </Card>
        <Card><Label>{t("qAdvisor")}</Label>
          <div className="mt-3 flex gap-2"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+212 6…" aria-label={t("qAdvisor")} className="num min-h-[52px] min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" /><Button variant="primary" icon="check" onClick={() => { save({ advisorPhone: phone.trim() }); toast(t("savedThanks"), undefined, "check"); }}>{t("save")}</Button></div>
          {p.advisorPhone && <Button href={`tel:${p.advisorPhone}`} variant="secondary" icon="user" className="mt-3">{t("callAdvisor")}</Button>}
        </Card>
        <Card><Label>{t("viewMode")}</Label><div className="mt-3"><Segmented<Mode> label={t("viewMode")} grow value={mode} onChange={(m) => { setMode(m); act({ type: "farmer", payload: { mode: m } }); }} options={[{ id: "simple", label: t("modeSimple"), icon: "sun" }, { id: "full", label: t("modeFull"), icon: "tasks" }]} /></div></Card>
      </div>
    </div>
  );
}
