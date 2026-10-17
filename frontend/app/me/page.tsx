"use client";
// Me: the farm, language, what the Copilot and the voice are, the sync queue, refresh, and the honest-limits box.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageSkeleton, PageTitle, useFmt } from "@/components/common";
import { Circle, Ic, useToast } from "@/components/ui";
import { cachedGet, fetchJson, type CopilotStatusOut, type SpeechStatusOut, type StateOut } from "@/lib/api";
import { stateKey, useActions, useAppState, useOffline } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { cropName, langs } from "@/lib/i18n";
import { FieldFinder } from "@/components/FieldFinder";

export default function Me() {
  const t = useT();
  const { num } = useFmt();
  const { lang, setLang, profile } = useFarm();
  const { data: s } = useAppState();
  const { queued, flush } = useActions();
  const offline = useOffline();
  const toast = useToast();
  const qc = useQueryClient();
  const [cp, setCp] = useState<CopilotStatusOut | null>(null);
  const [voice, setVoice] = useState<SpeechStatusOut | null>(null);
  useEffect(() => { fetchJson<CopilotStatusOut>("/api/copilot/status").then(setCp).catch(() => null); fetchJson<SpeechStatusOut>("/api/speech/status").then(setVoice).catch(() => null); }, []);
  if (!s) return <PageSkeleton />;
  const hasSR = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const refresh = async () => { const r = await cachedGet<StateOut>(stateKey(lang) + "&refresh=true"); if (r.data) qc.setQueryData(["state", stateKey(lang)], r.data); await qc.invalidateQueries(); toast(r.fromCache ? t("offlineSaved") : t("adviceRefreshed")); };
  return (<>
    <PageTitle title={t("navMe")} />
    <div className="grid2">
      <div>
        <div className="card flex items-center gap-3"><Circle tone="green"><Ic name="user" size={28} /></Circle><div><div className="text-[17px] font-bold">{s.field.name}</div><div className="sub">{t("ha", { n: num(s.field.area_ha, 1) })}</div></div></div>
        {profile && <div className="card"><div className="label">{t("myFarm")}</div><div className="sub mt-1.5">{[profile.location, cropName(lang, profile.crop), profile.irrigation].filter(Boolean).join(" · ")}</div><div className="sub mt-1">{t("profileApplied", { what: [s.field.crop, s.field.sowing_date, t("ha", { n: num(s.field.area_ha, 1) })].join(", ") })}</div><Link href="/?edit=1" className="btn-sec btn-sm mt-2.5">{t("editProfile")}</Link></div>}
        <div className="card"><div className="label">{t("language")}</div>
          <div role="group" aria-label={t("chooseLang")} className="mt-2 inline-flex overflow-hidden rounded-full border-[1.5px] border-leaf text-xs font-bold text-leaf">{langs.map((l) => <button key={l.id} type="button" lang={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={`min-h-12 min-w-12 px-3 ${lang === l.id ? "bg-leaf text-paper" : "opacity-80"}`}>{{ ar: "عربي", ary: "دارجة", fr: "FR", en: "EN" }[l.id]}</button>)}</div>
        </div>
        <div className="card"><div className="label">{t("copilot")}</div>
          <div className="sub mt-1.5">{cp ? (cp.mode === "model" ? t("copilotModel", { p: cp.provider ?? "" }) : t("copilotRules")) : "?"}{cp?.vision ? t("plusPhotos") : ""}</div>
          <div className="sub mt-1">{voice?.available ? t("voiceServer") : hasSR ? t("voiceBrowser") : t("voiceNone")}</div>
        </div>
      </div>
      <div>
        <div className="card"><div className="label">{t("waitingToSync")}</div><div className="mt-2 flex items-center gap-3"><b className="text-[28px]">{queued}</b>{queued ? <button type="button" onClick={async () => { const r = await flush(); toast(r ? (r.failed ? t("syncPartial", { a: r.sent, b: r.failed }) : t("synced")) : t("offline")); }} className="btn btn-sm">{t("syncNow")}</button> : <span className="sub"><Ic name="check" size={18} /></span>}</div></div>
        <button type="button" onClick={refresh} className="btn-sec mb-3"><Ic name="refresh" size={22} /> {t("refreshAdvice")}</button>
        <FieldFinder field={s.field} />
        <div id="about" className="card mt-3"><div className="label">{t("about")}</div>
          <p className="sub mt-2"><b>{t("realLabel")}</b> {t("realList")}</p>
          <p className="sub mt-2"><b>{t("simLabel")}</b> {t("simList")}</p>
          <p className="sub mt-2"><b>{t("notValidLabel")}</b> {t("notValidList")}</p>
          <p className="mt-3 text-center text-xs text-muted">Farm Advisor - Team 2 - BCG Platinion Hackathon 2026</p><p className="text-center text-xs text-muted">{t("footer")}</p>
        </div>
        {offline && <p className="sub mt-2 text-center">{t("offlineSaved")}</p>}
      </div>
    </div>
  </>);
}
