"use client";
// Follow-up after Done, in three small steps: a photo (described by the vision model when one exists, never diagnosed), the
// result as three big choices, an optional note. One Save.
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageSkeleton, PageTitle, TwoCol } from "@/components/common";
import { Button, Card, Icon, Label, Skeleton, useToast } from "@/components/ui";
import { fetchJson, type VisionOut } from "@/lib/api";
import { useActions, useAppState, useOffline } from "@/lib/data";
import { useT } from "@/lib/farm";

export default function Follow() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { data: s } = useAppState();
  const { act } = useActions();
  const offline = useOffline();
  const toast = useToast();
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ loading?: boolean; data?: VisionOut; reason?: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!s) return <PageSkeleton />;
  const task = s.tasks.find((x) => x.id === +id);

  const onFile = (f: File) => {
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = async () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.6); URL.revokeObjectURL(url); setPhoto(data);
      if (offline) return;
      setNotes({ loading: true });
      try { setNotes({ data: await fetchJson<VisionOut>("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo: data, zone: task?.zone_code ?? "A" }) }, 30000) }); }
      catch { setNotes({ reason: t("photoFail") }); }
    };
    img.src = url;
  };
  const save = () => {
    act({ type: "observation", payload: { task_id: +id, result, note: note || null, photo } });
    toast(offline ? t("savedOffline") : !result && !photo && !note ? t("savedNoResult") : t("savedThanks"), undefined, "check");
    router.push("/tasks");
  };
  const v = notes?.data as (VisionOut & { observations?: string[]; possible_causes_to_check?: string[]; note?: string; reason?: string }) | undefined;
  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <Card className="anim-fade-up"><div className="mb-3 flex items-center gap-2.5"><span className="num grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{n}</span><Label>{title}</Label></div>{children}</Card>
  );
  const choices = [["Better", "+", "better"], ["Same", "=", "same"], ["Worse", "−", "worse"]] as const;
  return (<>
    <PageTitle title={t("followUp")} back="/tasks" sub={task?.title} />
    <TwoCol main={<div className="space-y-3">
      <Step n={1} title={t("photo")}>
        <label className="pressable block w-full cursor-pointer rounded-lg border-2 border-dashed border-line-strong bg-surface-2 p-5 text-center text-brand transition-colors hover:bg-surface-3">
          {photo ? <img src={photo} alt={t("fieldPhoto")} className="mx-auto max-h-72 rounded-md" /> : <><Icon name="camera" size={40} className="mx-auto" /><div className="mt-1.5 text-sm font-semibold">{t("takePhoto")}</div></>}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {notes?.loading && <Skeleton className="mt-3 h-16" />}
        {notes?.reason && <p className="mt-3 text-sm text-text-2">{notes.reason}</p>}
        {v && (v.available === false ? <p className="mt-3 text-sm text-text-2">{v.reason ?? t("photoOff")}</p> : (
          <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm"><b>{t("photoNotes")}</b>
            <p className="mt-1">{v.observations?.length ? <><b>{t("visible")}</b> {v.observations.join("; ")}.</> : t("nothingVisible")}</p>
            {!!v.possible_causes_to_check?.length && <p className="mt-1"><b>{t("toCheck")}</b> {v.possible_causes_to_check.join("; ")}.</p>}
            {v.note && <p className="mt-1.5 text-xs text-text-3">{v.note}</p>}
          </div>
        ))}
      </Step>
      <Step n={2} title={t("howLook")}>
        <div className="grid grid-cols-3 gap-2">{choices.map(([r, e, key]) => <button key={r} type="button" onClick={() => setResult(r)} aria-pressed={result === r} className={`pressable flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border text-sm font-semibold transition-colors ${result === r ? "border-brand bg-brand-strong text-on-brand" : "border-line bg-surface hover:bg-surface-2"}`}><span className="num text-2xl leading-none">{e}</span>{t(key)}</button>)}</div>
      </Step>
      <Step n={3} title={t("noteOrYield")}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("noteOrYield")} aria-label={t("noteOrYield")} className="min-h-[52px] w-full rounded-lg border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand" />
      </Step>
    </div>} side={<div className="md:sticky md:top-4"><Button variant="accent" size="lg" icon="check" full onClick={save}>{t("save")}</Button><p className="mt-2 text-center text-xs text-text-3">{t("followNote")}</p></div>} />
  </>);
}
