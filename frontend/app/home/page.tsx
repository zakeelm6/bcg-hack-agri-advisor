"use client";
// Home: the answer in under 5 seconds. "Do this now" card, the land with the layers, the Copilot docked beside it.
import Link from "next/link";
import { CopilotDock } from "@/components/Copilot";
import { LandCard } from "@/components/Land";
import { PageSkeleton, useFmt } from "@/components/common";
import { Circle, Ic, Meter, taskIcon } from "@/components/ui";
import { openTasks, useAnomalies, useAppState, useLand } from "@/lib/data";
import { useT } from "@/lib/farm";

export default function Home() {
  const t = useT();
  const { num } = useFmt();
  const { data: s } = useAppState();
  const { data: land } = useLand();
  const { data: anomalies } = useAnomalies();
  if (!s) return <PageSkeleton />;
  const open = openTasks(s), first = open[0];
  return (
    <div className="md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-stretch md:gap-5">
      <section>
        {first ? (
          <Link href={`/tasks/${first.id}`} className="mb-3 flex w-full items-center gap-4 rounded-3xl bg-sun px-[18px] py-4 text-start text-amber-950 shadow-md hover:shadow-lg">
            <Circle size={64} tone="soft"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-[#7A4D00]"><Ic name={taskIcon(first.type)} size={32} /></span></Circle>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="label !text-current opacity-70">{t("doThisNow")}</span>
              <span className="text-[23px] font-bold leading-tight">{first.title}</span>
              <span className="mt-0.5 inline-flex items-center gap-1.5 font-semibold"><Ic name="clock" size={16} /> {first.when_text}</span>
              <span className="mt-2.5 flex flex-wrap items-center gap-2.5"><Meter conf={first.confidence} small light />{open.length > 1 && <span className="pill bg-black/15 text-current">{t("moreToday", { n: open.length - 1 })}</span>}</span>
            </span>
            <Ic name="chev" size={28} className="flex-none opacity-70 rtl:scale-x-[-1]" />
          </Link>
        ) : (
          <div className="mb-3 flex items-center gap-4 rounded-3xl bg-leaf px-[18px] py-4 text-paper"><Circle tone="green" size={64}><Ic name="check" size={30} /></Circle><span><span className="block text-[23px] font-bold">{t("allGood")}</span><span className="block font-semibold">{t("noTaskToday")}</span></span></div>
        )}
        <LandCard s={s} land={land} anomalies={anomalies} margin={32} title={<div className="mb-2 flex items-baseline justify-between"><b className="text-xl">{s.field.name}</b><span className="sub">{t("ha", { n: num(s.field.area_ha, 1) })}</span></div>} />
      </section>
      <CopilotDock className="flex min-h-[520px] flex-col md:min-h-[calc(100vh-150px)] [&>section]:flex-1" />
    </div>
  );
}
