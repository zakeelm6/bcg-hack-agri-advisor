"use client";
// Follow-up after Done: a photo (described by the vision model when one is configured, never diagnosed), the result, a note.
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageSkeleton, PageTitle } from "@/components/common";
import { Circle, Ic, Skeleton, useToast } from "@/components/ui";
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
    toast(offline ? t("savedOffline") : !result && !photo && !note ? t("savedNoResult") : t("savedThanks"));
    router.push("/tasks");
  };
  const v = notes?.data as (VisionOut & { observations?: string[]; possible_causes_to_check?: string[]; note?: string; reason?: string }) | undefined;
  return (<>
    <PageTitle title={t("followUp")} back="/tasks" />
    <div className="grid2">
      <div>
        <div className="card flex items-center gap-3"><Circle tone="green"><Ic name="check" size={26} w={2.5} /></Circle><div><div className="text-lg font-bold">{t("done")}</div><div className="sub">{task?.title}</div></div></div>
        <label className="mb-3 block w-full cursor-pointer rounded-3xl border-2 border-dashed border-leaf bg-soft p-5 text-center text-leaf">
          {photo ? <img src={photo} alt={t("fieldPhoto")} className="max-w-full rounded-2xl" /> : <><Ic name="camera" size={44} className="mx-auto" /><div className="mt-1.5 font-bold">{t("photo")}</div></>}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {notes?.loading && <Skeleton className="mb-3 h-20" />}
        {notes?.reason && <div className="card sub">{notes.reason}</div>}
        {v && (v.available === false ? <div className="card sub">{v.reason ?? t("photoOff")}</div> : (
          <div className="card"><div className="label">{t("photoNotes")}</div>
            <div className="sub mt-1.5">{v.observations?.length ? <><b>{t("visible")}</b> {v.observations.join("; ")}.</> : t("nothingVisible")}</div>
            {!!v.possible_causes_to_check?.length && <div className="sub mt-1"><b>{t("toCheck")}</b> {v.possible_causes_to_check.join("; ")}.</div>}
            {v.note && <div className="mt-1.5 text-xs text-muted">{v.note}</div>}
          </div>
        ))}
      </div>
      <div>
        <div className="label mb-2">{t("howLook")}</div>
        <div className="mb-3 flex flex-wrap gap-2">{([["Better", "+", "better"], ["Same", "=", "same"], ["Worse", "−", "worse"]] as const).map(([r, e, key]) => <button key={r} type="button" onClick={() => setResult(r)} aria-pressed={result === r} className={`chip chip-big ${result === r ? "chip-on" : ""}`}>{e} {t(key)}</button>)}</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("noteOrYield")} aria-label={t("noteOrYield")} className="field mb-3" />
        <button type="button" onClick={save} className="btn"><Ic name="check" size={24} w={3} /> {t("save")}</button>
      </div>
    </div>
  </>);
}
