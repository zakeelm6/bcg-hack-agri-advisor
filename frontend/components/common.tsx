"use client";
// Pieces shared by several screens: page title with optional back arrow, task card, the loading skeleton, date helpers.
import Link from "next/link";
import type { TaskOut } from "@/lib/api";
import { useFarm, useT } from "@/lib/farm";
import type { Lang } from "@/lib/i18n";
import { Circle, Ic, Meter, Skeleton, taskIcon } from "./ui";

export const locale = (lang: Lang) => (lang === "ar" ? "ar-MA-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB");
export const useFmt = () => {
  const { lang } = useFarm();
  return { date: (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(locale(lang), { day: "numeric", month: "short" }), num: (n: number, d = 0) => Number(n).toLocaleString(locale(lang), { minimumFractionDigits: d, maximumFractionDigits: d }) };
};

export function PageTitle({ title, back }: { title: string; back?: string }) {
  const t = useT();
  if (!back) return <h1 className="pagetitle">{title}</h1>;
  return (
    <div className="mb-3 flex items-center gap-2">
      <Link href={back} aria-label={t("back")} className="grid h-12 w-12 flex-none place-items-center rounded-full bg-surface text-leaf"><Ic name="chev" size={26} className="scale-x-[-1] rtl:scale-x-100" /></Link>
      <h1 className="pagetitle !mb-0">{title}</h1>
    </div>
  );
}

export function TaskCard({ t: task }: { t: TaskOut }) {
  const t = useT();
  const off = task.status !== "open";
  return (
    <Link href={`/tasks/${task.id}`} className="card flex w-full items-center gap-3 text-start hover:shadow-md">
      <span className={off ? "opacity-60" : ""}><Circle tone={task.type === "irrigate" ? "amber" : "soft"}><Ic name={taskIcon(task.type)} size={28} /></Circle></span>
      <div className="min-w-0 flex-1">
        <div className={`text-lg font-bold leading-tight ${off ? "opacity-60" : ""}`}>{task.title}</div>
        <div className="sub inline-flex items-center gap-1"><Ic name="clock" size={14} /> {task.when_text}</div>
        {!off && <div className="mt-1.5"><Meter conf={task.confidence} small /></div>}
      </div>
      {task.status === "done" && <span className="pill pill-dk gap-1"><Ic name="check" size={16} w={3} />{t("done")}</span>}
      {task.status === "skipped" && <span className="pill pill-ol">{t("skipped")}</span>}
    </Link>
  );
}

export const PageSkeleton = () => <div role="status"><Skeleton className="mb-4 h-8 w-2/5" /><Skeleton className="mb-3 h-20" /><Skeleton className="mb-3 h-20" /><Skeleton className="h-20" /></div>;
