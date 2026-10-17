"use client";
// Soil test form: pH, organic matter, moisture for one zone. Ranges validated here for feedback and again by the server.
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageSkeleton, PageTitle } from "@/components/common";
import { Ic, useToast } from "@/components/legacy-ui";
import { useActions, useAppState, useOffline } from "@/lib/data";
import { useT } from "@/lib/farm";
import { SoilLine, type Test } from "@/components/SoilLine";

export default function Soil() {
  const t = useT();
  const { zone: zoneParam } = useParams<{ zone: string }>();
  const { data: s } = useAppState();
  const { act } = useActions();
  const offline = useOffline();
  const toast = useToast();
  const router = useRouter();
  const [zone, setZone] = useState(zoneParam);
  const [ph, setPh] = useState(""), [om, setOm] = useState(""), [mo, setMo] = useState("");
  const [msg, setMsg] = useState("");
  if (!s) return <PageSkeleton />;
  const save = () => {
    const num = (v: string) => (v === "" ? null : Number(v));
    const p = num(ph), o = num(om), m = num(mo);
    const bad = (v: number | null, lo: number, hi: number) => v != null && !(v >= lo && v <= hi);
    if (p == null && o == null && m == null) return setMsg(t("atLeastOne"));
    if (bad(p, 3, 10)) return setMsg(t("phRange"));
    if (bad(o, 0, 15)) return setMsg(t("omRange"));
    if (bad(m, 3, 60)) return setMsg(t("moRange"));
    act({ type: "soil_test", payload: { zone_code: zone, ph: p, om_pct: o, moisture: m == null ? null : m / 100 } });
    toast(offline ? t("savedOffline") : t("soilSaved"));
    router.push("/field");
  };
  const Field = ({ id, label, range, hint, value, set, step }: { id: string; label: string; range: string; hint: string; value: string; set: (v: string) => void; step: string }) => (
    <label className="mb-1 block"><span className="mx-1 mb-1 block text-sm font-semibold">{label} <small className="font-medium text-muted">{range}</small></span><input id={id} type="number" inputMode="decimal" step={step} value={value} onChange={(e) => set(e.target.value)} placeholder={hint} className="field mb-3 placeholder:opacity-55" /></label>
  );
  return (<>
    <PageTitle title={t("soilTestZone", { z: zone })} back="/field" />
    <div className="grid2">
      <div className="card">
        <div className="mb-3 flex flex-wrap gap-2">{s.zones.map((z) => <button key={z.code} type="button" onClick={() => { setZone(z.code); setMsg(""); }} aria-pressed={z.code === zone} className={`chip chip-big ${z.code === zone ? "chip-on" : ""}`}>{z.code}</button>)}</div>
        <Field id="soil-ph" label="pH" range={t("range", { a: 3, b: 10 })} hint={t("eg", { v: "6.4" })} value={ph} set={setPh} step="0.1" />
        <Field id="soil-om" label={t("organicPct")} range={t("range", { a: 0, b: 15 })} hint={t("eg", { v: "2.1" })} value={om} set={setOm} step="0.1" />
        <Field id="soil-m" label={t("moisturePct")} range={t("range", { a: 3, b: 60 })} hint={t("eg", { v: "24" })} value={mo} set={setMo} step="1" />
        {msg && <div role="alert" className="sub mb-2.5 text-red-800">{msg}</div>}
        <button type="button" onClick={save} className="btn"><Ic name="check" size={24} w={3} /> {t("save")}</button>
      </div>
      <div className="card"><div className="label">{t("savedTests")}</div><div className="sub mt-1.5">{s.soil_tests.length ? s.soil_tests.map((x) => <div key={x.zone_code}><SoilLine test={x as Test} /></div>) : t("noneYet")}</div></div>
    </div>
  </>);
}
