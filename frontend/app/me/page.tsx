"use client";
// Me, in three sections: You (farm, language, appearance), Data (sync, refresh, where the data comes from), Find your field.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FieldFinder } from "@/components/FieldFinder";
import FieldMap from "@/components/land/FieldMap";
import { LANG_NATIVE } from "@/components/LangControl";
import { PageSkeleton, PageTitle, TwoCol, useFmt } from "@/components/common";
import { Badge, Button, Card, Icon, Label, ListItem, Segmented, Sheet, Stat, useToast } from "@/components/ui";
import { cachedGet, fetchJson, type CopilotStatusOut, type SpeechStatusOut, type StateOut } from "@/lib/api";
import { stateKey, useActions, useAppState, useOffline } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { cropName, langs } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function Me() {
  const t = useT();
  const { num } = useFmt();
  const { lang, setLang, profile } = useFarm();
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { data: s } = useAppState();
  const { queued, flush } = useActions();
  const offline = useOffline();
  const toast = useToast();
  const qc = useQueryClient();
  const [cp, setCp] = useState<CopilotStatusOut | null>(null);
  const [voice, setVoice] = useState<SpeechStatusOut | null>(null);
  const [about, setAbout] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { fetchJson<CopilotStatusOut>("/api/copilot/status").then(setCp).catch(() => null); fetchJson<SpeechStatusOut>("/api/speech/status").then(setVoice).catch(() => null); }, []);
  useEffect(() => { if (location.hash === "#about") setAbout(true); }, []);
  if (!s) return <PageSkeleton />;
  const hasSR = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const refresh = async () => { setRefreshing(true); const r = await cachedGet<StateOut>(stateKey(lang) + "&refresh=true"); if (r.data) qc.setQueryData(["state", stateKey(lang)], r.data); await qc.invalidateQueries(); setRefreshing(false); toast(r.fromCache ? t("offlineSaved") : t("adviceRefreshed"), undefined, "refresh"); };
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mb-5"><h2 className="font-display mb-2 px-1 text-xl">{title}</h2><div className="space-y-2.5">{children}</div></section>;
  return (<>
    <PageTitle title={t("navMe")} end={<Button variant="ghost" size="sm" icon="info" onClick={() => setAbout(true)}>{t("about")}</Button>} />
    <TwoCol main={<>
      <Section title={t("secYou")}>
        <Button href="/setup" variant="secondary" icon="contrast" full>{t("setup")}</Button>
        <ListItem icon="leaf" iconTone="brand" title={s.field.name} sub={`${t("ha", { n: num(s.field.area_ha, 1) })} · ${s.field.crop}`} />
        {profile && <Card><Label>{t("myFarm")}</Label><p className="mt-1 text-sm text-text-2">{[profile.location, cropName(lang, profile.crop), profile.irrigation].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-text-3">{t("profileNote")}</p><Button href="/start?edit=1" variant="ghost" size="sm" icon="refresh" className="mt-2">{t("editProfile")}</Button></Card>}
        <Card><Label>{t("language")}</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">{langs.map((l) => <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`pressable flex min-h-12 items-center justify-between rounded-lg border px-3 text-start text-base font-semibold ${lang === l.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>{LANG_NATIVE[l.id]}{lang === l.id && <Icon name="check" size={18} />}</button>)}</div>
        </Card>
        <Card><Label>{t("theme")}</Label>
          <div className="mt-2"><Segmented label={t("theme")} value={theme} onChange={setTheme} grow options={[{ id: "auto", label: t("themeAuto") }, { id: "light", label: t("themeLight"), icon: "sun" }, { id: "dark", label: t("themeDark"), icon: "moon" }]} /></div>
          <button type="button" role="switch" aria-checked={contrast} onClick={() => setContrast(!contrast)} className="pressable mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-line px-3 text-start text-sm font-semibold hover:bg-surface-2">
            <span className="inline-flex items-center gap-2"><Icon name="contrast" size={20} />{t("highContrast")}</span>
            <span aria-hidden className={`relative h-7 w-12 flex-none rounded-full transition-colors ${contrast ? "bg-brand-strong" : "bg-line-strong"}`}><i className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-1 transition-[inset-inline-start] ${contrast ? "start-6" : "start-1"}`} /></span>
          </button>
        </Card>
      </Section>
    </>} side={<>
      <Section title={t("secData")}>
        <Card className="flex items-center justify-between gap-3"><Stat value={queued} label={t("waitingToSync")} />{queued ? <Button size="sm" variant="primary" icon="refresh" onClick={async () => { const r = await flush(); toast(r ? (r.failed ? t("syncPartial", { a: r.sent, b: r.failed }) : t("synced")) : t("offline"), undefined, r ? "check" : "cloudoff"); }}>{t("syncNow")}</Button> : <Badge tone="success" icon="check">{t("synced")}</Badge>}</Card>
        <Button variant="secondary" icon="refresh" full loading={refreshing} onClick={refresh}>{t("refreshAdvice")}</Button>
        <Card>
          <Label>{t("copilot")}</Label>
          <p className="mt-1.5 text-sm">{cp ? (cp.mode === "model" ? t("copilotModel", { p: cp.provider ?? "" }) : t("copilotRules")) : "…"}{cp?.vision ? t("plusPhotos") : ""}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2"><Icon name="mic" size={15} />{voice?.available ? t("voiceServer") : hasSR ? t("voiceBrowser") : t("voiceNone")}</p>
        </Card>
        {offline && <p className="text-center text-xs text-text-3">{t("offlineSaved")}</p>}
      </Section>
      <Section title={t("findField")}>
        <FieldMap center={profile?.lat !== undefined && profile?.lon !== undefined ? [profile.lat, profile.lon] : [s.field.lat, s.field.lon]} fallbackHa={s.field.area_ha} />
        <FieldFinder field={s.field} />
      </Section>
    </>} />
    <Sheet open={about} onClose={() => setAbout(false)} title={t("about")} closeLabel={t("close")}>
      <div className="space-y-3 pb-2 text-sm">
        <p><Badge tone="success" icon="check" className="me-1.5">{t("realLabel").replace(":", "")}</Badge>{t("realList")}</p>
        <p><Badge tone="simulated" icon="sensor" className="me-1.5">{t("simLabel").replace(":", "")}</Badge>{t("simList")}</p>
        <p><Badge tone="warning" icon="warning" className="me-1.5">{t("notValidLabel").replace(":", "")}</Badge>{t("notValidList")}</p>
        <p className="pt-2 text-xs text-text-3">Farm Advisor · Team 2 · BCG Platinion Hackathon 2026<br />{t("footer")}</p>
      </div>
    </Sheet>
  </>);
}
