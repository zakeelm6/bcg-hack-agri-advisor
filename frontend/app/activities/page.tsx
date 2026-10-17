"use client";
// What the farmer did: watered (how much, with pictures), sprayed, planted, spent money, other work. One tap records it; the engine
// learns from it (a recorded watering makes it wait and raises the moisture estimate; spending is answered by the Copilot).
// Same queue as every other write: saved on the phone, sent when the connection is there.
import { useState } from "react";
import { PageSkeleton, PageTitle, TwoCol, useFmt } from "@/components/common";
import { Button, Card, FormField, Icon, Label, Segmented, useToast } from "@/components/ui";
import { useActions, useActivities } from "@/lib/data";
import { today, useFarm, useT } from "@/lib/farm";
import { activityTypes } from "@/lib/i18n";
import { CURRENCY, money } from "@/lib/money";
import { useQueryClient } from "@tanstack/react-query";

type Kind = "irrigation" | "treatment" | "planting" | "expense" | "other";
const ICON: Record<Kind, string> = { irrigation: "drop", treatment: "shield", planting: "leaf", expense: "sell", other: "check" };
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export default function Activities() {
  const t = useT();
  const { lang } = useFarm();
  const { date } = useFmt();
  const { data } = useActivities();
  const { act } = useActions();
  const toast = useToast();
  const qc = useQueryClient();
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [asking, setAsking] = useState<Kind | null>(null);
  const [cost, setCost] = useState("");

  const record = (type: Kind, extra: { cost?: number; mm?: number } = {}) => {
    const client_id = crypto.randomUUID();
    const body = { client_id, type, date: when === "today" ? today() : yesterday(), note: "", cost: extra.cost ?? null, zone: null, amount_mm: extra.mm ?? null };
    act({ type: "activity", payload: body });
    qc.setQueryData(["activities", "/api/activities"], (old: { activities: typeof body[] } | null | undefined) => ({ activities: [body, ...(old?.activities ?? [])] }));
    setAsking(null); setCost("");
    const label = t(activityTypes.find((a) => a.id === type)!.key);
    toast(t("recorded", { what: label }), { label: t("undo"), fn: () => {
      act({ type: "activity_remove", payload: { client_id } });
      qc.setQueryData(["activities", "/api/activities"], (old: { activities: typeof body[] } | null | undefined) => ({ activities: (old?.activities ?? []).filter((x) => x.client_id !== client_id) }));
    } }, "check");
  };
  const tap = (type: Kind) => (type === "expense" || type === "irrigation" ? setAsking(type) : record(type));
  const rows = data?.activities ?? [];

  const form = (
    <div className="space-y-3">
      <Card>
        <Label>{t("whatDidYouDo")}</Label>
        <p className="mt-1 text-sm text-text-2">{t("tapToRecord")}</p>
        <Segmented value={when} onChange={setWhen} label={t("today")} grow className="mt-3" options={[{ id: "today", label: t("today") }, { id: "yesterday", label: t("yesterday") }]} />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {activityTypes.map((a) => (
            <button key={a.id} type="button" onClick={() => tap(a.id)} aria-pressed={asking === a.id}
              className="pressable flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface p-3 text-center font-semibold hover:bg-surface-2">
              <Icon name={ICON[a.id]} size={30} className="text-brand" />{t(a.key)}
            </button>
          ))}
        </div>
      </Card>
      {asking === "irrigation" && (
        <Card className="anim-fade-up">
          <Label>{t("howMuchWater")}</Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([["waterLittle", 10], ["waterNormal", 20], ["waterLot", 30]] as const).map(([key, mm]) => (
              <button key={key} type="button" onClick={() => record("irrigation", { mm })} className="pressable flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface p-2 text-center font-semibold hover:bg-surface-2">
                <Icon name="drop" size={26} className="text-brand" />{t(key)}<span className="num text-sm font-normal text-text-2">{mm} mm</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)}>{t("cancel")}</Button>
            <Button variant="secondary" onClick={() => record("irrigation")}>{t("waterUnknown")}</Button>
          </div>
        </Card>
      )}
      {asking === "expense" && (
        <Card className="anim-fade-up">
          <form onSubmit={(e) => { e.preventDefault(); const v = Number(cost); if (v >= 0 && cost !== "") record("expense", { cost: v }); }}>
            <FormField label={t("howMuch")} unit={CURRENCY} type="number" inputMode="decimal" min="0" step="any" required autoFocus value={cost} onChange={(e) => setCost(e.target.value)} />
            <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="ghost" type="button" onClick={() => setAsking(null)}>{t("cancel")}</Button><Button type="submit">{t("save")}</Button></div>
          </form>
        </Card>
      )}
      <Button variant="secondary" icon="flask" href="/field/soil/A" full>{t("addSoilTest")}</Button>
    </div>
  );
  const history = (
    <Card>
      <Label>{t("history")}</Label>
      {!data ? <PageSkeleton /> : rows.length === 0 ? <p className="mt-2 text-sm text-text-2">{t("nothingRecorded")}</p> : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((a) => {
            const meta = activityTypes.find((x) => x.id === a.type)!;
            return (
              <li key={a.client_id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3"><Icon name={ICON[a.type as Kind]} size={22} className="text-brand" /><span>{t(meta.key)}{a.amount_mm ? <span className="num text-text-2"> {a.amount_mm} mm</span> : null}</span></span>
                <span className="text-end text-sm text-text-2">{date(a.date)}{a.cost != null && <b className="num block text-base text-text">{money(lang, a.cost)}</b>}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
  return (<>
    <PageTitle title={t("navActivities")} back="/field" />
    <TwoCol main={form} side={history} />
  </>);
}
