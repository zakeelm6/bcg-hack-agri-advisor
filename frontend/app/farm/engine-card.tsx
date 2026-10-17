"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { openTasks, useEngine, type EngineTask } from "@/lib/engine";
import { today, useFarm, useT } from "@/lib/farm";
import { Icon } from "@/lib/icons";
import { speak, stopSpeaking } from "@/lib/voice";

// What the engine decided for the farmer's field, as a picture first: what to do, when, how sure we are, and two big answers.
// Same look as the rest of the app (serif titles, green on warm paper, one tap, read aloud on request).

const ICON: Record<string, string> = { irrigate: "drip", fertilize: "shovel", inspect: "search" };
const LEVEL = { High: 3, Medium: 2, Low: 1 } as const;
const ACTIVITY = { irrigate: "irrigation", fertilize: "other" } as const; // what the farmer did, for the Activities list

function Meter({ level }: { level: EngineTask["confidence"] }) {
  const t = useT();
  const word = { High: t("confHigh"), Medium: t("confMedium"), Low: t("confLow") }[level];
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`${t("howSure")}: ${word}`}>
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => <span key={i} className={`h-2.5 w-7 rounded-full ${i <= LEVEL[level] ? "bg-leaf" : "bg-line"}`} />)}
      </span>
      <span className="font-medium">{word}</span>
    </span>
  );
}

// Whose field the advice is about, and whether the satellite has seen it yet.
const fieldNote = (f: { source: string; satellite_status: string } | undefined) =>
  f?.source !== "own" ? "demoFieldNote" : f.satellite_status === "pending" ? "satPending" : f.satellite_status === "failed" ? "satFailed" : f.satellite_status === "none" ? "satNone" : "ownFieldNote";

export default function EngineCard() {
  const { lang, logActivity, removeActivity } = useFarm();
  const t = useT();
  const { state, stale, loading, answer } = useEngine(lang);
  const [open, setOpen] = useState<number>();      // task whose details are shown
  const [asking, setAsking] = useState<number>();  // task for which we ask why it cannot be done
  const [last, setLast] = useState<{ task: EngineTask; activity?: string }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); stopSpeaking(); }, []);

  if (!API) return null; // without a backend the app is exactly what it was

  const tasks = state ? openTasks(state.tasks) : [];
  const [first, ...others] = tasks;
  // Calm alerts besides the tasks. A vigor alert that already is an open task ("Inspect zone D") is not said twice.
  const shown = (state?.alerts ?? []).filter((a) => a.kind !== "water" && !(a.kind === "crop" && tasks.some((k) => k.key === `inspect:${a.key.split(":")[1]}`)));

  function done(task: EngineTask) {
    answer(task, "done");
    const kind = ACTIVITY[task.type as keyof typeof ACTIVITY];
    const activity = kind ? logActivity({ type: kind, date: today(), note: task.title, ...(kind === "irrigation" ? { zone: task.zone_code, ...(task.unit === "mm" && task.qty ? { mm: task.qty } : {}) } : {}) }) : undefined; // the Activities list follows by itself
    clearTimeout(timer.current);
    setLast({ task, activity });
    timer.current = setTimeout(() => setLast(undefined), 6000);
  }
  function undo() {
    if (!last) return;
    answer(last.task, "open");
    if (last.activity) removeActivity(last.activity);
    setLast(undefined);
  }
  function cannot(task: EngineTask, reason: string) {
    answer(task, "skipped", reason);
    setAsking(undefined);
  }
  const listen = (x: EngineTask) => speak(`${x.title}. ${x.when_text}. ${x.why}`, lang);

  const details = (x: EngineTask) => (
    <dl className="mt-4 space-y-3 text-lg">
      <div><dt className="label">{t("whyLabel")}</dt><dd>{x.why}</dd></div>
      <div><dt className="label">{t("cost")}</dt><dd className="flex items-start gap-2"><Icon name="coins" className="mt-1 h-5 w-5 shrink-0 text-muted" />{x.cost}</dd></div>
      <div><dt className="label">{t("howSure")}</dt><dd>{x.conf_reason}</dd></div>
      <div><dt className="label">{t("planB")}</dt><dd>{x.plan_b}</dd></div>
    </dl>
  );

  const actions = (x: EngineTask) => asking === x.id ? (
    <div className="mt-4">
      <p className="font-medium">{t("whyNot")}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {([["water", "skipNoMeans", "no water or product"], ["hourglass", "skipNoTime", "no time"], ["check", "skipNotNeeded", "not needed"]] as const).map(([icon, key, reason]) => (
          <button key={key} type="button" onClick={() => cannot(x, reason)} className="btn-ghost flex flex-col items-center gap-1 py-3 text-center text-base leading-tight">
            <Icon name={icon} className="h-7 w-7 text-leaf" />{t(key)}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setAsking(undefined)} className="mt-2 text-muted underline underline-offset-4">{t("cancel")}</button>
    </div>
  ) : (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <button type="button" onClick={() => done(x)} className="btn flex items-center justify-center gap-2 py-4 text-lg"><Icon name="check" />{t("done")}</button>
      <button type="button" onClick={() => setAsking(x.id)} className="btn-ghost py-4 text-lg">{t("cannotDo")}</button>
    </div>
  );

  return (
    <section aria-label={t("doThisNow")} className="mb-12">
      {loading && !state ? (
        <div className="card animate-pulse py-10 text-muted" role="status">{t("adviceLoading")}</div>
      ) : !state ? (
        <div className="card text-muted" role="status"><Icon name="alert" className="me-2 inline h-5 w-5 text-sun" />{t("noNetRetry")}</div>
      ) : !first ? (
        <div className="card flex items-center gap-4 bg-leaf-soft">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-card text-leaf"><Icon name="check" className="h-9 w-9" /></span>
          <p className="text-xl">{t("noTaskToday")}</p>
        </div>
      ) : (
        <div className="card border-leaf/30 p-5 md:p-6">
          <p className="label">{t("doThisNow")}</p>
          <div className="mt-3 flex items-start gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><Icon name={ICON[first.type] ?? "sprout"} className="h-11 w-11" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-3xl leading-tight md:text-4xl">{first.title}</h2>
              <p className="mt-2 flex items-center gap-2 text-lg"><Icon name="hourglass" className="h-5 w-5 text-muted" />{first.when_text}</p>
              <p className="mt-2 text-lg"><Meter level={first.confidence} /></p>
            </div>
            <button type="button" onClick={() => listen(first)} aria-label={t("listen")} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><Icon name="speaker" className="h-6 w-6" /></button>
          </div>
          <button type="button" onClick={() => setOpen(open === first.id ? undefined : first.id)} aria-expanded={open === first.id} className="mt-4 font-medium text-leaf underline underline-offset-4">{t("why")}</button>
          {open === first.id && details(first)}
          {actions(first)}

          {others.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="label">{t("moreToday", { n: others.length })}</p>
              <ul className="divide-y divide-line">
                {others.map((x) => (
                  <li key={x.id} className="py-3">
                    <button type="button" onClick={() => setOpen(open === x.id ? undefined : x.id)} aria-expanded={open === x.id} className="flex w-full items-center gap-3 text-start text-lg">
                      <Icon name={ICON[x.type] ?? "sprout"} className="h-7 w-7 shrink-0 text-leaf" />
                      <span className="flex-1"><span className="block leading-snug">{x.title}</span><span className="text-base text-muted">{x.when_text}</span></span>
                    </button>
                    {open === x.id && <>{details(x)}<p className="mt-3"><Meter level={x.confidence} /></p>{actions(x)}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {last && (
        <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-4 py-3 text-lg text-leaf">
          <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5" />{t("taskDone", { what: last.task.title })}</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={undo}>{t("undo")}</button>
        </div>
      )}
      {state?.alerts.filter((a) => a.kind === "water").map((a) => (
        <p key={a.key} className="mt-3 flex items-start gap-2 text-lg"><Icon name="drip" className="mt-1 h-5 w-5 shrink-0 text-leaf" /><span><b>{a.title}.</b> {a.body}</span></p>
      ))}
      {state && shown.length > 0 && (
        <div className="mt-6">
          <p className="label">{t("alertsTitle")}</p>
          <ul className="mt-2 space-y-3">
            {shown.map((a) => {
              const zone = a.key.split(":")[1];
              const action = a.kind === "data" && zone ? { href: `/activities?soil=${zone}`, text: t("alertAddTest") } : a.kind === "crop" ? { href: "/farm", text: t("alertLook") } : null;
              return (
                <li key={a.key} className="card flex items-start gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"><Icon name={a.kind === "data" ? "search" : a.kind === "crop" ? "sprout" : "alert"} className="h-6 w-6" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-medium leading-snug">{a.title}</p>
                    <p className="mt-1 text-base text-muted">{a.body}</p>
                    {action && <Link href={action.href} className="btn-ghost mt-3 inline-flex py-2.5">{action.text}</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {state && (
        <ul className="mt-4 space-y-1 text-base text-muted">
          {state.data_notes.vigor.startsWith("sentinel") && <li>{t("noteSatOnly")}</li>}
          {state.data_notes.vigor === "simulated" && <li>{t("noteVigorSim")}</li>}
          {state.data_notes.vigor === "none" && <li>{t("noteNoSat")}</li>}
          {state.data_notes.sensors === "simulated" && <li>{t("noteSensorsSim")}</li>}
        </ul>
      )}
      {state && (
        <p className="mt-3 flex items-start gap-2 text-base text-muted">
          <Icon name="alert" className="mt-1 h-4 w-4 shrink-0 text-sun" />
          <span>{t(fieldNote(state.field))}{stale && ` ${t("savedAdvice")}.`}</span>
        </p>
      )}
    </section>
  );
}
