"use client";
// Home: the answer in under 5 seconds. One amber card ("Do this now"), the land as the hero, the Copilot docked beside it.
import { CopilotDock } from "@/components/Copilot";
import { LandCard } from "@/components/Land";
import { useFmt } from "@/components/common";
import { Badge, Card, ConfidenceMeter, Icon, Label, Skeleton, taskIcon } from "@/components/ui";
import { openTasks, useAnomalies, useAppState, useLand } from "@/lib/data";
import { useT } from "@/lib/farm";

export default function Home() {
  const t = useT();
  const { num } = useFmt();
  const { data: s } = useAppState();
  const { data: land } = useLand();
  const { data: anomalies } = useAnomalies();
  if (!s) return <HomeSkeleton />;
  const open = openTasks(s), first = open[0];
  return (
    <div className="md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-stretch md:gap-5">
      <section className="space-y-3">
        {first ? (
          <Card tone="accent" interactive href={`/tasks/${first.id}`} className="anim-fade-up flex items-center gap-4 !p-5">
            <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-white/85 text-amber-900"><Icon name={taskIcon(first.type)} size={32} /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <Label inherit className="opacity-80">{t("doThisNow")}</Label>
              <span className="font-display mt-0.5 text-2xl leading-tight">{first.title}</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-base font-semibold"><Icon name="clock" size={16} /> {first.when_text}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-2.5"><ConfidenceMeter conf={first.confidence} size="sm" onDark />{open.length > 1 && <Badge className="!bg-black/25 !text-current">{t("moreToday", { n: open.length - 1 })}</Badge>}</span>
            </span>
            <Icon name="chev" size={28} className="flex-none opacity-70 rtl:-scale-x-100" />
          </Card>
        ) : (
          <Card tone="brand" className="anim-fade-up flex items-center gap-4 !p-5">
            <span className="grid h-16 w-16 flex-none place-items-center rounded-full bg-white/15"><Icon name="check" size={30} /></span>
            <span><span className="font-display block text-2xl">{t("allGood")}</span><span className="block text-base opacity-90">{t("noTaskToday")}</span></span>
          </Card>
        )}
        <LandCard s={s} land={land} anomalies={anomalies} margin={30} title={<div className="mb-2.5 flex items-baseline justify-between gap-3 px-1"><h2 className="font-display text-xl">{s.field.name}</h2><span className="num text-sm text-text-2">{t("ha", { n: num(s.field.area_ha, 1) })}</span></div>} />
      </section>
      <CopilotDock className="mt-3 flex min-h-[560px] flex-col md:mt-0 md:min-h-[calc(100vh-150px)] [&>section]:flex-1" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div role="status" className="md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-5">
      <div className="space-y-3"><Skeleton className="h-[132px] rounded-xl" /><Skeleton className="aspect-square max-h-[62vh] w-full rounded-xl" /></div>
      <Skeleton className="mt-3 h-[560px] rounded-xl md:mt-0" />
    </div>
  );
}
