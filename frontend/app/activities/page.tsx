"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { enqueue, flush } from "@/lib/queue";
import { today, useFarm, useT, type ActivityType } from "@/lib/farm";
import { activityTypes, intlLocale } from "@/lib/i18n";
import { CURRENCY, money } from "@/lib/money";
import { Icon } from "@/lib/icons";

const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

function Activities() {
  const { activities, logActivity, removeActivity, lang } = useFarm();
  const t = useT();
  const note = useSearchParams().get("note") ?? ""; // "Record what you did" from a finished task
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [asking, setAsking] = useState<ActivityType>(); // expense: ask the amount before saving; irrigation: ask how much water
  const [cost, setCost] = useState("");
  const [last, setLast] = useState<{ id: string; type: ActivityType }>();
  const presetZone = useSearchParams().get("soil"); // "Add a soil test" from an alert opens the form on that zone
  const [soil, setSoil] = useState<{ zone: string } | undefined>(presetZone ? { zone: presetZone } : undefined);
  const [vals, setVals] = useState({ ph: "", om: "", moisture: "" });
  const [soilMsg, setSoilMsg] = useState<string>();

  // The soil test goes to the engine through the same queue as everything else: saved on the phone, sent when the connection is there.
  function saveSoil(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const ph = num(vals.ph), om = num(vals.om), mo = num(vals.moisture);
    if (ph === null && om === null && mo === null) return setSoilMsg(t("soilNeedOne"));
    enqueue({ type: "soil_test", payload: { zone_code: soil!.zone, ph, om_pct: om, moisture: mo === null ? null : mo / 100 } });
    void flush();
    setSoilMsg(t("soilSaved", { z: soil!.zone })); setSoil(undefined); setVals({ ph: "", om: "", moisture: "" });
  }

  // One tap records it. Spending needs an amount, watering asks "how much?" with pictures (mm 0 = the farmer does not know).
  function record(type: ActivityType, amount?: number, mm?: number) {
    if (type === "expense" && amount === undefined) return setAsking("expense");
    if (type === "irrigation" && mm === undefined) return setAsking("irrigation");
    const id = logActivity({ type, date: when === "today" ? today() : yesterday(), note, cost: amount, ...(mm ? { mm } : {}) });
    setLast({ id, type });
    setAsking(undefined); setCost("");
  }
  const label = (type: ActivityType) => activityTypes.find((a) => a.id === type)!;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-2">
      <section>
        <h1 className="font-serif text-4xl">{t("whatDidYouDo")}</h1>
        <p className="mt-2 text-lg text-muted">{t("tapToRecord")}</p>
        {note && <p className="mt-2 flex items-center gap-2 text-lg"><Icon name="tasks" className="h-5 w-5 text-muted" />{note}</p>}

        <div role="group" className="mt-5 grid grid-cols-2 gap-2">
          {(["today", "yesterday"] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWhen(w)} aria-pressed={when === w}
              className={`rounded-full border py-2.5 text-lg ${when === w ? "border-leaf bg-leaf-soft font-semibold text-leaf" : "border-line bg-card"}`}>
              {t(w)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activityTypes.map((a) => (
            <button key={a.id} type="button" onClick={() => record(a.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card py-6 text-lg font-medium active:scale-[.97]">
              <Icon name={a.icon} className="h-10 w-10 text-leaf" />
              {t(a.key)}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => { setSoil({ zone: soil?.zone ?? "A" }); setSoilMsg(undefined); }}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-card py-4 text-lg font-medium active:scale-[.97]">
          <Icon name="shovel" className="h-8 w-8 text-leaf" />{t("soilTest")}
        </button>

        {soil && (
          <form className="mt-4 rounded-2xl border border-leaf bg-card p-4" onSubmit={saveSoil}>
            <p className="text-lg font-medium">{t("soilWhichZone")}</p>
            <div role="group" className="mt-2 grid grid-cols-4 gap-2">
              {["A", "B", "C", "D"].map((z) => (
                <button key={z} type="button" aria-pressed={soil.zone === z} onClick={() => setSoil({ zone: z })}
                  className={`rounded-full border py-2.5 text-xl font-semibold ${soil.zone === z ? "border-leaf bg-leaf-soft text-leaf" : "border-line"}`}>{z}</button>
              ))}
            </div>
            <p className="mt-3 text-muted">{t("soilHelp")}</p>
            {([["ph", "soilPh", "7.0"], ["om", "soilOm", "2.0"], ["moisture", "soilMoisture", "25"]] as const).map(([k, label, ph]) => (
              <label key={k} className="mt-3 block text-lg font-medium">{t(label)}
                <input type="number" inputMode="decimal" min="0" step="any" placeholder={ph} value={vals[k]}
                  onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="field mt-1 text-center text-2xl" />
              </label>
            ))}
            {soilMsg && <p role="alert" className="mt-3 text-sun">{soilMsg}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setSoil(undefined)}>{t("cancel")}</button>
              <button className="btn">{t("save")}</button>
            </div>
          </form>
        )}
        {!soil && soilMsg && <p role="status" className="mt-4 rounded-2xl bg-leaf-soft px-4 py-3 text-lg text-leaf">{soilMsg}</p>}

        {asking === "irrigation" && (
          <div className="mt-4 rounded-2xl border border-leaf bg-card p-4">
            <p className="text-lg font-medium">{t("howMuchWater")}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([["waterLittle", 10], ["waterNormal", 20], ["waterLot", 30]] as const).map(([key, mm]) => (
                <button key={key} type="button" onClick={() => record("irrigation", undefined, mm)} className="btn-ghost flex flex-col items-center gap-1 py-4 text-lg">
                  <Icon name="drip" className="h-8 w-8 text-leaf" />{t(key)}<span className="text-base text-muted">{mm} mm</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setAsking(undefined)}>{t("cancel")}</button>
              <button type="button" className="btn-ghost" onClick={() => record("irrigation", undefined, 0)}>{t("waterUnknown")}</button>
            </div>
          </div>
        )}

        {asking === "expense" && (
          <form className="mt-4 rounded-2xl border border-leaf bg-card p-4" onSubmit={(e) => { e.preventDefault(); record("expense", Number(cost)); }}>
            <label className="block text-lg font-medium" htmlFor="cost">{t("howMuch")} <span className="text-muted">({CURRENCY})</span></label>
            <input id="cost" type="number" inputMode="decimal" min="0" step="any" required autoFocus value={cost}
              onChange={(e) => setCost(e.target.value)} className="field mt-3 text-center text-3xl" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setAsking(undefined)}>{t("cancel")}</button>
              <button className="btn">{t("save")}</button>
            </div>
          </form>
        )}

        {last && (
          <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-4 py-3 text-lg text-leaf">
            <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5" />{t("recorded", { what: t(label(last.type).key) })}</span>
            <button type="button" className="font-semibold underline underline-offset-4" onClick={() => { removeActivity(last.id); setLast(undefined); }}>
              {t("undo")}
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-3xl">{t("history")}</h2>
        {activities.length === 0 ? (
          <p className="mt-3 text-lg text-muted">{t("nothingRecorded")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-lg">
                <span className="flex items-center gap-3">
                  <Icon name={label(a.type).icon} className="h-6 w-6 text-leaf" />
                  <span>{t(label(a.type).key)}{a.mm ? <span className="text-muted"> {a.mm} mm</span> : null}{a.note && <span className="text-muted">, {a.note}</span>}</span>
                </span>
                <span className="shrink-0 text-end text-muted">
                  {new Date(`${a.date}T00:00`).toLocaleDateString(intlLocale(lang), { month: "short", day: "numeric" })}
                  {a.cost !== undefined && <span className="block font-medium text-ink">{money(lang, a.cost)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Activities /></Suspense>;
}
