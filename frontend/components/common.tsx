"use client";
// Page templates shared by the screens: title row with an optional back link, the two-column layout, formatting helpers.
import type { TaskOut } from "@/lib/api";
import { useFarm, useT } from "@/lib/farm";
import type { Lang } from "@/lib/i18n";
import { Badge, Button, ConfidenceMeter, ListItem, Skeleton, SkeletonCard, taskIcon } from "./ui";

export const locale = (lang: Lang) => (lang === "ar" || lang === "ary" ? "ar-MA-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB");
export const useFmt = () => {
  const { lang } = useFarm();
  const t = useT();
  const loc = locale(lang);
  return {
    date: (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "short" }),
    dateLong: (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" }),
    /** today / tomorrow / weekday for the next 6 days / short date */
    dayWord: (iso: string) => { const d = new Date(iso + "T12:00:00"), now = new Date(); now.setHours(12, 0, 0, 0); const diff = Math.round((d.getTime() - now.getTime()) / 864e5); return diff === 0 ? t("today") : diff === 1 ? t("tomorrow") : diff === -1 ? t("yesterday") : diff > 1 && diff < 7 ? d.toLocaleDateString(loc, { weekday: "long" }) : d.toLocaleDateString(loc, { day: "numeric", month: "short" }); },
    num: (n: number, d = 0) => Number(n).toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }),
  };
};

export function PageTitle({ title, back, end, sub }: { title: string; back?: string; end?: React.ReactNode; sub?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && <Button href={back} variant="ghost" size="sm" icon="chev" iconOnly className="-ms-2 [&_svg]:-scale-x-100 rtl:[&_svg]:scale-x-100">{t("back")}</Button>}
      <div className="min-w-0 flex-1"><h1 className="font-display text-2xl leading-tight md:text-3xl">{title}</h1>{sub && <p className="mt-0.5 text-sm text-text-2">{sub}</p>}</div>
      {end}
    </div>
  );
}

/** Two columns on wide screens: the main column (list, land) and a side column (detail, summary). Phones stack them. */
export function TwoCol({ main, side, sideFirst }: { main: React.ReactNode; side: React.ReactNode; sideFirst?: boolean }) {
  return <div className="md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start md:gap-6"><div className={sideFirst ? "md:order-2" : ""}>{main}</div><div className={`mt-4 md:mt-0 ${sideFirst ? "md:order-1" : ""}`}>{side}</div></div>;
}

export function TaskCard({ t: task }: { t: TaskOut }) {
  const t = useT();
  const off = task.status !== "open";
  return (
    <ListItem href={`/tasks/${task.id}`} icon={taskIcon(task.type)} iconTone={off ? "neutral" : task.type === "irrigate" ? "accent" : "neutral"} muted={off} title={task.title} sub={task.when_text}
      meta={!off ? <ConfidenceMeter conf={task.confidence} size="sm" /> : undefined}
      end={task.status === "done" ? <Badge tone="success" icon="check">{t("done")}</Badge> : task.status === "skipped" ? <Badge tone="outline">{t("skipped")}</Badge> : task.verify_status === "escalated" ? <Badge tone="warning" icon="warning">{t("escalated")}</Badge> : undefined} chevron={!off} className="mb-2.5" />
  );
}

export const PageSkeleton = () => <div role="status" className="space-y-3"><Skeleton className="mb-5 h-9 w-2/5" /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
