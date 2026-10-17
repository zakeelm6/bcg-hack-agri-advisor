"use client";
// Sell: the harvest estimate (not validated, says so), a sale offer, simulated buyers. Every number comes from the server.
import { useState } from "react";
import { PageSkeleton, PageTitle, useFmt } from "@/components/common";
import { Circle, Ic, Tag, useToast } from "@/components/ui";
import { useActions, useForecast, useOffers } from "@/lib/data";
import { useT } from "@/lib/farm";

export default function Sell() {
  const t = useT();
  const { date, num } = useFmt();
  const { data: F } = useForecast();
  const { data: O } = useOffers();
  const { act } = useActions();
  const toast = useToast();
  const [confirm, setConfirm] = useState<number | null>(null);
  if (!F || !O) return <PageSkeleton />;
  const listed = !!F.listing;
  return (<>
    <PageTitle title={t("navSell")} />
    <div className="grid2">
      <div>
        <div className="card"><div className="label">{t("harvest")} <span className="pill pill-ol ms-1.5">{t("demo")}</span></div>
          <div className="text-3xl font-bold">{t("tonnes", { a: num(F.qty_min_t, 1), b: num(F.qty_max_t, 1) })}</div>
          <div className="sub inline-flex items-center gap-1"><Ic name="clock" size={15} /> {date(F.window_start)} - {date(F.window_end)}</div>
          <div className="sub mt-1.5"><Tag warn>{t("notValidated")}</Tag> {F.crop === "Not identified" && t("cropUnknown")}</div>
          <details className="mt-2"><summary>{t("notes")}</summary><div className="sub mt-1.5">{F.advice} {F.note}</div></details>
        </div>
        <button type="button" disabled={listed} onClick={() => { act({ type: "listing", payload: {} }); toast(t("offerCreated")); }} className="btn"><Ic name={listed ? "check" : "sell"} size={24} w={listed ? 3 : 2} /> {listed ? t("offerPublished") : t("createOffer")}</button>
      </div>
      <div>
        <div className="label my-1 mb-2">{t("offers")} <Tag warn>{t("buyersSim")}</Tag></div>
        {O.offers.map((o) => (
          <div key={o.id} className="card flex flex-wrap items-center gap-3">
            <Circle><Ic name={o.kind === "institution" ? "school" : o.kind === "trader" ? "truck" : "coop"} size={26} /></Circle>
            <div className="min-w-[180px] flex-1"><div className="text-lg font-bold leading-tight">{o.buyer}</div>
              <div className="sub"><b className="text-lg text-ink">{num(o.price_mad_kg, 2)}</b> {t("madKg")}{o.est_value_mad != null && <>  -  {num(o.est_value_mad)} {t("mad")}</>}</div>
              {confirm === o.id && <div className="mt-2.5 rounded-2xl bg-page p-3"><div className="sub"><b>{t("acceptQ", { p: num(o.price_mad_kg, 2) })}</b> {t("othersDeclined")}</div>
                <div className="mt-2 flex flex-wrap gap-2.5"><button type="button" onClick={() => { setConfirm(null); act({ type: "offer_accept", payload: { offer_id: o.id } }); toast(t("offerAccepted")); }} className="btn btn-sm"><Ic name="check" size={20} w={3} /> {t("yesAccept")}</button><button type="button" onClick={() => setConfirm(null)} className="btn-sec btn-sm">{t("no")}</button></div></div>}
            </div>
            {o.status === "open" ? (confirm !== o.id && <button type="button" onClick={() => setConfirm(o.id)} className="btn-sec btn-sm max-md:w-full">{t("accept")}</button>) : <span className={`pill ${o.status === "accepted" ? "pill-dk" : "pill-ol"}`}>{o.status === "accepted" ? t("accepted") : t("declined")}</span>}
          </div>
        ))}
      </div>
    </div>
  </>);
}
