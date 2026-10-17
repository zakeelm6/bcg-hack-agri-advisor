"use client";
// Task detail: what, when, Done / Cannot do it (with a reason), how sure and why, cost and plan B, Listen, Copilot, Soil test.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCopilot } from "@/components/Copilot";
import { PageSkeleton, PageTitle } from "@/components/common";
import { Circle, Ic, Meter, taskIcon, useToast } from "@/components/ui";
import { useActions, useAppState } from "@/lib/data";
import { useT } from "@/lib/farm";

const REASONS = [["no_means", "skipNoMeans"], ["no_time", "skipNoTime"], ["not_needed", "skipNotNeeded"]] as const;

export default function Task() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { data: s } = useAppState();
  const { act } = useActions();
  const toast = useToast();
  const router = useRouter();
  const cp = useCopilot();
  const [skipping, setSkipping] = useState(false);
  if (!s) return <PageSkeleton />;
  const task = s.tasks.find((x) => x.id === +id);
  if (!task) return (<><PageTitle title={t("task")} back="/tasks" /><div className="card">{t("taskGone")}</div></>);

  const done = () => {
    act({ type: "task_status", payload: { task_id: task.id, status: "done" } });
    router.push(`/tasks/${task.id}/follow`);
    toast(t("done"), { label: t("undo"), fn: () => { act({ type: "task_status", payload: { task_id: task.id, status: "open" } }); router.push(`/tasks/${task.id}`); } });
  };
  const skip = (reason: string) => {
    act({ type: "task_status", payload: { task_id: task.id, status: "skipped" } });
    act({ type: "observation", payload: { task_id: task.id, result: "skipped", note: "reason:" + reason } });
    router.push("/tasks");
    toast(t("skippedToast"), { label: t("undo"), fn: () => { act({ type: "task_status", payload: { task_id: task.id, status: "open" } }); router.push(`/tasks/${task.id}`); } });
  };
  return (<>
    <PageTitle title={t("task")} back="/tasks" />
    <div className="grid2">
      <div className="card">
        <div className="flex items-center gap-3"><Circle size={64} tone={task.type === "irrigate" ? "amber" : "soft"}><Ic name={taskIcon(task.type)} size={34} /></Circle><div><div className="text-xl font-bold">{task.title}</div><div className="sub inline-flex items-center gap-1"><Ic name="clock" size={15} /> {task.when_text}</div></div></div>
        {task.status === "open" ? (skipping ? (
          <div className="my-3.5 rounded-2xl bg-page p-3">
            <div className="label">{t("whyNot")}</div>
            <div className="my-2.5 flex flex-wrap gap-2">{REASONS.map(([k, key]) => <button key={k} type="button" onClick={() => skip(k)} className="chip chip-big bg-surface">{t(key)}</button>)}</div>
            <button type="button" onClick={() => setSkipping(false)} className="btn-sec btn-sm">{t("back")}</button>
          </div>
        ) : (
          <div className="my-3.5 flex flex-wrap gap-2.5"><button type="button" onClick={done} className="btn flex-1 min-w-[150px]"><Ic name="check" size={24} w={3} /> {t("done")}</button><button type="button" onClick={() => setSkipping(true)} className="btn-sec flex-1 min-w-[150px]">{t("cannotDo")}</button></div>
        )) : <div className="my-3.5"><span className={`pill ${task.status === "done" ? "pill-dk" : "pill-ol"}`}>{task.status === "done" ? t("done") : t("skipped")}</span></div>}
        <div className="mb-0.5 mt-3"><Meter conf={task.confidence} /></div>
        <div className="sub">{task.conf_reason}</div>
        <details open><summary>{t("whyLabel")}</summary><div className="sub mt-1.5">{task.why}</div></details>
        <details><summary>{t("cost")}</summary><div className="sub mt-1.5">{task.cost}</div></details>
        <details><summary>{t("planB")}</summary><div className="sub mt-1.5">{task.plan_b}</div></details>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => cp.speakTask(task)} className="btn-sec flex-1 min-w-[150px]"><Ic name="speaker" size={22} /> {t("listen")}</button>
        <button type="button" onClick={() => cp.setOpen(true)} className="btn-sec flex-1 min-w-[150px]"><Ic name="mic" size={22} /> {t("copilot")}</button>
        {task.confidence !== "High" && <Link href={`/field/soil/${task.zone_code}`} className="btn-sec flex-1 min-w-[150px]"><Ic name="flask" size={22} /> {t("soilTest")}</Link>}
      </div>
    </div>
  </>);
}
