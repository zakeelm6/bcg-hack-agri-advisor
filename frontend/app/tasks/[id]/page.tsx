"use client";
// Task detail: what and when, one primary action (Done), "cannot do it" as a quiet alternative with a reason, how sure and
// why in body type, cost and plan B as two rows, then Listen / Copilot / Soil test.
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCopilot } from "@/components/Copilot";
import { PageSkeleton, PageTitle, TwoCol } from "@/components/common";
import { Badge, Banner, Button, Card, ConfidenceMeter, Icon, Label, taskIcon, useToast } from "@/components/ui";
import { VerifyBadge } from "@/components/VerifyBadge";
import { useActions, useAppState } from "@/lib/data";
import { useT } from "@/lib/farm";

const REASONS = [["no_means", "skipNoMeans", "drop"], ["no_time", "skipNoTime", "clock"], ["not_needed", "skipNotNeeded", "check"]] as const;

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
  if (!task) return (<><PageTitle title={t("task")} back="/tasks" /><Card>{t("taskGone")}</Card></>);

  const done = () => {
    act({ type: "task_status", payload: { task_id: task.id, status: "done" } });
    router.push(`/tasks/${task.id}/follow`);
    toast(t("done"), { label: t("undo"), fn: () => { act({ type: "task_status", payload: { task_id: task.id, status: "open" } }); router.push(`/tasks/${task.id}`); } }, "check");
  };
  const skip = (reason: string) => {
    act({ type: "task_status", payload: { task_id: task.id, status: "skipped" } });
    act({ type: "observation", payload: { task_id: task.id, result: "skipped", note: "reason:" + reason } });
    router.push("/tasks");
    toast(t("skippedToast"), { label: t("undo"), fn: () => { act({ type: "task_status", payload: { task_id: task.id, status: "open" } }); router.push(`/tasks/${task.id}`); } });
  };
  const head = (
    <Card className="anim-fade-up">
      <div className="flex items-start gap-4">
        <span className={`grid h-16 w-16 flex-none place-items-center rounded-full ${task.type === "irrigate" ? "bg-accent text-on-accent" : "bg-brand-soft text-brand"}`}><Icon name={taskIcon(task.type)} size={32} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">{task.title}</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-base text-text-2"><Icon name="clock" size={16} /> {task.when_text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><ConfidenceMeter conf={task.confidence} /><VerifyBadge status={task.verify_status} /></div>
        </div>
      </div>
      {task.verify_status === "escalated" && <Banner tone="warning" icon="warning" title={t("escalated")} className="mt-4">{task.verify_detail}</Banner>}
      {task.status === "open" ? (skipping ? (
        <div className="anim-fade-up mt-5 rounded-lg bg-surface-2 p-4">
          <Label>{t("whyNot")}</Label>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">{REASONS.map(([k, key, icon]) => <Button key={k} variant="secondary" icon={icon} onClick={() => skip(k)}>{t(key)}</Button>)}</div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSkipping(false)}>{t("back")}</Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant={task.verify_status === "escalated" ? "secondary" : "accent"} size="lg" icon="check" onClick={done} className="sm:flex-1">{t("done")}</Button>
          <Button variant="ghost" onClick={() => setSkipping(true)}>{t("cannotDo")}</Button>
        </div>
      )) : <div className="mt-5"><Badge tone={task.status === "done" ? "success" : "outline"} size="md" icon={task.status === "done" ? "check" : undefined}>{task.status === "done" ? t("done") : t("skipped")}</Badge></div>}
    </Card>
  );
  const body = (
    <div className="space-y-3">
      <Card>
        <Label>{t("whyLabel")}</Label>
        <p className="mt-1.5 text-base leading-relaxed">{task.why}</p>
        <p className="mt-2 text-sm text-text-2">{task.conf_reason}</p>
        {task.verify_status !== "escalated" && task.verify_detail && <p className="mt-2 flex items-start gap-1.5 text-xs text-text-3"><Icon name="shield" size={14} className="mt-0.5" /><span><b>{t("verifyTitle")}:</b> {task.verify_detail}</span></p>}
      </Card>
      <Card className="!p-0">
        <div className="flex gap-3 border-b border-line p-4"><Icon name="sell" size={22} className="mt-0.5 flex-none text-text-3" /><div><Label>{t("cost")}</Label><p className="mt-1 text-sm">{task.cost}</p></div></div>
        <div className="flex gap-3 p-4"><Icon name="shield" size={22} className="mt-0.5 flex-none text-text-3" /><div><Label>{t("planB")}</Label><p className="mt-1 text-sm">{task.plan_b}</p></div></div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon="speaker" onClick={() => cp.speakTask(task)}>{t("listen")}</Button>
        <Button variant="secondary" icon="mic" onClick={() => cp.setOpen(true)}>{t("copilot")}</Button>
        {task.confidence !== "High" && <Button variant="secondary" icon="flask" href={`/field/soil/${task.zone_code}`}>{t("soilTest")}</Button>}
      </div>
    </div>
  );
  return (<>
    <PageTitle title={t("task")} back="/tasks" sub={t("zone", { z: task.zone_code })} />
    <TwoCol main={head} side={body} />
  </>);
}
