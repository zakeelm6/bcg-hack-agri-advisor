"use client";
// Today (simple mode): the land with the zone that needs you, one big card in plain words, Done / Can't, a big mic, and the
// advisor's number. No numbers on this screen; "See the numbers" opens the full task page.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCopilot } from "@/components/Copilot";
import { LandSvg } from "@/components/Land";
import { useFmt } from "@/components/common";
import { Button, Card, ConfidenceMeter, Icon, Skeleton, taskIcon, useToast } from "@/components/ui";
import type { TaskOut } from "@/lib/api";
import { openTasks, useActions, useAnomalies, useAppState, useBriefing, useLand, useOffline } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { groupTasks, plainDetail, plainTitle } from "@/lib/plain";

const REASONS = [["no_means", "skipNoMeans", "drop"], ["no_time", "skipNoTime", "clock"], ["not_needed", "skipNotNeeded", "check"]] as const;

export default function Today() {
  const t = useT();
  const { profile } = useFarm();
  const { data: s } = useAppState();
  const { data: land } = useLand();
  const { data: anomalies } = useAnomalies();
  const { data: brief } = useBriefing();
  const offline = useOffline();
  const { act } = useActions();
  const toast = useToast();
  const router = useRouter();
  const cp = useCopilot();
  const [cant, setCant] = useState<number | null>(null);
  const [result, setResult] = useState<{ id: number; step: "result" } | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  void useFmt;
  if (!s) return <div role="status" className="space-y-3"><Skeleton className="aspect-square w-full rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>;
  const groups = groupTasks(openTasks(s)), g0 = groups[0], first = g0?.task, rest = groups.slice(1);
  const escalated = first?.verify_status === "escalated";
  const title = (g: { task: TaskOut; zones: string[] }) => plainTitle(t, g.task, g.zones, s.zones.length);

  const done = (tasks: TaskOut[]) => { tasks.forEach((task) => act({ type: "task_status", payload: { task_id: task.id, status: "done" } })); setResult({ id: tasks[0].id, step: "result" }); toast(t("wellDone"), { label: t("undo"), fn: () => { tasks.forEach((task) => act({ type: "task_status", payload: { task_id: task.id, status: "open" } })); setResult(null); } }, "check"); };
  const skip = (tasks: TaskOut[], reason: string) => { tasks.forEach((task) => { act({ type: "task_status", payload: { task_id: task.id, status: "skipped" } }); act({ type: "observation", payload: { task_id: task.id, result: "skipped", note: "reason:" + reason } }); }); setCant(null); toast(t("skippedToast"), { label: t("undo"), fn: () => tasks.forEach((task) => act({ type: "task_status", payload: { task_id: task.id, status: "open" } })) }); };
  const saveResult = (r: string) => { if (result) act({ type: "observation", payload: { task_id: result.id, result: r } }); setResult(null); toast(t("savedThanks"), undefined, "check"); };
  const speak = (text: string) => cp.speakText(text);
  // tap a zone: say what to do there today, in plain words (the engine's tasks for that zone, or "nothing to do")
  // on screen: the plain words only (no numbers); spoken: the same, plus the engine's reason
  const zoneLine = (code: string) => { const mine = openTasks(s).filter((x) => x.zone_code === code); return mine.length ? mine.map((x) => `${plainTitle(t, x)}. ${x.when_text}.`).join(" ") : t("zoneNothing", { z: code }); };
  const zoneText = (code: string) => { const mine = openTasks(s).filter((x) => x.zone_code === code); return mine.length ? mine.map((x) => `${plainTitle(t, x)}. ${x.when_text}. ${x.why}`).join(" ") : t("zoneNothing", { z: code }); };
  const pickZone = (code: string | null) => { setZone(code); if (code) speak(zoneText(code)); };

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {/* the land: zones coloured, the pin on the zone that needs you, no numbers */}
      <div className="overflow-hidden rounded-xl bg-neutral-900"><LandSvg s={s} layer="vigor" land={land} anomalies={anomalies} margin={24} simple selected={zone} onSelect={pickZone} /></div>
      {zone ? (
        <button type="button" onClick={() => speak(zoneText(zone))} className="pressable anim-fade-up flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-start"><span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-surface-2 text-brand"><Icon name="speaker" size={24} /></span><span className="flex-1"><b className="font-display text-lg">{t("zone", { z: zone })}</b><span className="block text-base">{zoneLine(zone)}</span></span></button>
      ) : <p className="text-center text-sm text-text-3">{t("zoneTapHint")}</p>}

      {result ? (
        <Card className="anim-fade-up text-center">
          <Icon name="check" size={36} className="mx-auto text-success" />
          <h2 className="font-display mt-2 text-2xl">{t("howLook")}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">{([["Better", "+", "better"], ["Same", "=", "same"], ["Worse", "−", "worse"]] as const).map(([r, e, key]) => <button key={r} type="button" onClick={() => saveResult(r)} className="pressable flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface text-base font-semibold hover:bg-surface-2"><span className="num text-3xl leading-none">{e}</span>{t(key)}</button>)}</div>
          <Button variant="ghost" className="mt-3" onClick={() => setResult(null)}>{t("skip")}</Button>
        </Card>
      ) : first ? (
        <Card tone={escalated ? "default" : "accent"} className="anim-fade-up !p-5">
          <div className="flex items-center gap-4">
            <span className={`grid h-20 w-20 flex-none place-items-center rounded-full ${escalated ? "bg-warning-soft text-on-warning-soft" : "bg-white/85 text-amber-900"}`}><Icon name={taskIcon(first.type)} size={40} /></span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight">{title(g0)}</h1>
              <p className="mt-1 text-lg font-semibold">{first.when_text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><ConfidenceMeter conf={first.confidence} onDark={!escalated} /></div>
            </div>
            <Button variant={escalated ? "secondary" : "ghost"} size="lg" icon="speaker" iconOnly className={escalated ? "" : "!text-current hover:!bg-black/10"} onClick={() => speak(`${title(g0)}. ${first.when_text}. ${plainDetail(first)}`)}>{t("listen")}</Button>
          </div>
          {escalated && <p className="mt-3 rounded-lg bg-warning-soft p-3 text-sm text-on-warning-soft"><b>{t("escalated")}.</b> {first.verify_detail}</p>}
          {escalated ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button href={`/field/soil/${first.zone_code}`} variant="accent" size="lg" icon="flask" className="min-h-24 flex-col !gap-1 !rounded-xl">{t("checkSoil")}</Button>
              {profile?.advisorPhone ? <Button href={`tel:${profile.advisorPhone}`} variant="secondary" size="lg" icon="user" className="min-h-24 flex-col !gap-1 !rounded-xl">{t("callAdvisor")}</Button> : <Button href="/setup" variant="secondary" size="lg" icon="user" className="min-h-24 flex-col !gap-1 !rounded-xl">{t("callAdvisor")}</Button>}
            </div>
          ) : cant === first.id ? (
            <div className="anim-fade-up mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {REASONS.map(([k, key, icon]) => <button key={k} type="button" onClick={() => skip(g0.tasks, k)} className="pressable flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-white/90 text-base font-semibold text-neutral-900"><Icon name={icon} size={26} />{t(key)}</button>)}
              <Button variant="ghost" className={`!text-current sm:col-span-3`} onClick={() => setCant(null)}>{t("back")}</Button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => done(g0.tasks)} className="pressable flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl bg-brand-strong text-xl font-bold text-on-brand shadow-2"><Icon name="check" size={34} />{t("done")}</button>
              <button type="button" onClick={() => setCant(first.id)} className="pressable flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl bg-white/90 text-xl font-bold text-neutral-900"><Icon name="x" size={34} />{t("cant")}</button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" onClick={() => speak(first.why)} className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/10 px-4 font-semibold"><Icon name="chat" size={16} />{t("tellMeWhy")}</button>
            <Link href={`/tasks/${first.id}`} className="inline-flex min-h-11 items-center gap-1 underline opacity-80">{t("seeNumbers")}<Icon name="chev" size={14} className="rtl:-scale-x-100" /></Link>
          </div>
        </Card>
      ) : (
        <Card tone="brand" className="anim-fade-up flex items-center gap-4 !p-5"><span className="grid h-20 w-20 flex-none place-items-center rounded-full bg-white/15"><Icon name="sun" size={40} /></span><div><h1 className="font-display text-3xl">{t("allGood")}</h1><p className="mt-1 text-base opacity-90">{t("nextCheck")}</p></div></Card>
      )}

      {rest.length > 0 && !result && (
        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-text-2">{t("alsoToday")}</p>
          {rest.map((g) => <Link key={g.task.id} href={`/tasks/${g.task.id}`} className="pressable flex items-center gap-3 rounded-xl border border-line bg-surface p-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-brand"><Icon name={taskIcon(g.task.type)} size={24} /></span><span className="flex-1 text-lg font-semibold">{title(g)}</span><span className="text-sm text-text-2">{g.task.when_text}</span></Link>)}
        </div>
      )}

      {/* voice: the big mic opens the Copilot; "Listen to today" reads the briefing; the advisor is one tap away */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => cp.setOpen(true)} className="pressable flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-on-accent shadow-2"><Icon name="mic" size={40} />{t("speak")}</button>
        <button type="button" disabled={!brief?.text} onClick={() => brief?.text && speak(brief.text)} className="pressable flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface text-lg font-bold text-brand disabled:opacity-50"><Icon name="speaker" size={40} />{t("listenToday")}</button>
      </div>
      {profile?.advisorPhone && <Button href={`tel:${profile.advisorPhone}`} variant="secondary" size="lg" full icon="user">{t("callAdvisor")}</Button>}
      {offline && <p className="flex items-center justify-center gap-1.5 text-center text-sm text-text-2"><Icon name="cloudoff" size={16} />{t("savedOffline")}</p>}
      {(s.data_notes as { sensors?: string }).sensors === "none" && <p className="text-center text-xs text-text-3">{t("noSensorsNote")}</p>}
      <p className="pt-2 text-center"><Link href="/setup" className="text-sm text-text-3 underline">{t("setup")}</Link></p>
      {void router}
    </div>
  );
}
