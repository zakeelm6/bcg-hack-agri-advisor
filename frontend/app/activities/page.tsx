"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { today, useFarm, type ActivityType } from "@/lib/farm";

const types: ActivityType[] = ["irrigation", "treatment", "planting", "expense", "other"];

function Activities() {
  const { activities, logActivity } = useFarm();
  const prefill = useSearchParams().get("note") ?? "";
  const [type, setType] = useState<ActivityType>("irrigation");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState(prefill);
  const [cost, setCost] = useState("");
  const [flash, setFlash] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    logActivity({ type, date, note: note.trim(), cost: cost ? Number(cost) : undefined });
    setNote(""); setCost("");
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  }

  return (
    <div className="space-y-5 pt-2">
      <h1 className="font-serif text-3xl">Activities</h1>

      <form onSubmit={submit} className="card space-y-3">
        <p className="label">Record what you did</p>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
              className={`rounded-full border px-3.5 py-1.5 text-sm capitalize ${type === t ? "border-leaf bg-leaf-soft font-medium text-leaf" : "border-line"}`}>
              {t}
            </button>
          ))}
        </div>
        <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={type === "irrigation" ? "e.g. 2 hours drip, Field A" : type === "expense" ? "e.g. Fertilizer, 3 bags" : "What did you do?"} aria-label="Details" />
        <div className="flex gap-2">
          <input type="date" className="field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" required />
          <input type="number" inputMode="decimal" min="0" step="any" className="field" value={cost} onChange={(e) => setCost(e.target.value)}
            placeholder={type === "expense" ? "Cost" : "Cost (optional)"} aria-label="Cost" required={type === "expense"} />
        </div>
        <button className="btn w-full">{flash ? "✓ Recorded" : "Record activity"}</button>
      </form>

      <section>
        <h2 className="label mb-2">History</h2>
        <div className="card divide-y divide-line p-0">
          {activities.length === 0 && <p className="p-4 text-muted">Nothing recorded yet. Records help the Co-Pilot give better advice.</p>}
          {activities.map((a) => (
            <div key={a.id} className="flex justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium capitalize">{a.type}</p>
                {a.note && <p className="text-muted">{a.note}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-muted">{a.date}</p>
                {a.cost !== undefined && <p className="font-medium">{a.cost.toLocaleString()}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Activities /></Suspense>;
}
