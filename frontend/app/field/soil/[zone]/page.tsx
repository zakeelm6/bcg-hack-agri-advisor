"use client";
// Soil test: one zone, three values with their ranges, one Save. Validated here for instant feedback and again by the server.
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SoilLine, type Test } from "@/components/SoilLine";
import { PageSkeleton, PageTitle, TwoCol } from "@/components/common";
import { Button, Card, FormField, Label, Segmented, useToast } from "@/components/ui";
import { useActions, useAppState, useOffline } from "@/lib/data";
import { useT } from "@/lib/farm";

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
  const [err, setErr] = useState<{ ph?: string; om?: string; mo?: string; all?: string }>({});
  if (!s) return <PageSkeleton />;
  const save = () => {
    const num = (v: string) => (v === "" ? null : Number(v));
    const p = num(ph), o = num(om), m = num(mo);
    const bad = (v: number | null, lo: number, hi: number) => v != null && !(v >= lo && v <= hi);
    const e: typeof err = {};
    if (p == null && o == null && m == null) e.all = t("atLeastOne");
    if (bad(p, 3, 10)) e.ph = t("phRange");
    if (bad(o, 0, 15)) e.om = t("omRange");
    if (bad(m, 3, 60)) e.mo = t("moRange");
    setErr(e); if (Object.keys(e).length) return;
    act({ type: "soil_test", payload: { zone_code: zone, ph: p, om_pct: o, moisture: m == null ? null : m / 100 } });
    toast(offline ? t("savedOffline") : t("soilSaved"), undefined, "check");
    router.push("/field");
  };
  const z = s.zones.find((x) => x.code === zone);
  return (<>
    <PageTitle title={t("soilTestZone", { z: zone })} back="/field" sub={z?.conf_reason} />
    <TwoCol main={<Card className="space-y-4">
      <div><Label className="mb-2">{t("zone", { z: "" }).trim()}</Label><Segmented label={t("zone", { z: "" })} value={zone} onChange={(v) => { setZone(v); setErr({}); }} grow options={s.zones.map((x) => ({ id: x.code, label: x.code }))} /></div>
      <FormField label="pH" hint={t("range", { a: 3, b: 10 })} placeholder={t("eg", { v: "6.4" })} type="number" inputMode="decimal" step="0.1" value={ph} onChange={(e) => setPh(e.target.value)} error={err.ph} />
      <FormField label={t("organicPct")} unit="%" hint={t("range", { a: 0, b: 15 })} placeholder={t("eg", { v: "2.1" })} type="number" inputMode="decimal" step="0.1" value={om} onChange={(e) => setOm(e.target.value)} error={err.om} />
      <FormField label={t("moisturePct")} unit="%" hint={t("range", { a: 3, b: 60 })} placeholder={t("eg", { v: "24" })} type="number" inputMode="decimal" step="1" value={mo} onChange={(e) => setMo(e.target.value)} error={err.mo} />
      {err.all && <p role="alert" className="text-sm text-danger">{err.all}</p>}
      <Button variant="accent" size="lg" icon="check" full onClick={save}>{t("save")}</Button>
    </Card>} side={<Card><Label>{t("savedTests")}</Label><div className="mt-2 space-y-1 text-sm text-text-2">{s.soil_tests.length ? s.soil_tests.map((x) => <div key={x.zone_code}><SoilLine test={x as Test} /></div>) : <p>{t("noneYet")}</p>}</div><p className="mt-3 text-xs text-text-3">{t("soilWhy")}</p></Card>} />
  </>);
}
