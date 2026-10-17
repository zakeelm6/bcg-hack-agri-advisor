"use client";
// Sell: one honesty strip for the whole page (demo data), the harvest estimate as a stat, one primary action, buyers as a list
// with the price large and the server-computed value small. Accept asks once.
import { useState } from "react";
import { PageSkeleton, PageTitle, TwoCol, useFmt } from "@/components/common";
import { Badge, Banner, Button, Card, Icon, Label, ListItem, Stat, useToast } from "@/components/ui";
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
    <Banner tone="warning" icon="warning" title={t("sellDemoTitle")} className="mb-4">{t("sellDemoBody")}{F.crop === "Not identified" ? ` ${t("cropUnknown")}` : ""}</Banner>
    <TwoCol main={<div className="space-y-3">
      <Card className="anim-fade-up">
        <Label end={<Badge tone="outline">{t("notValidated")}</Badge>}>{t("harvest")}</Label>
        <Stat value={`${num(F.qty_min_t, 1)} – ${num(F.qty_max_t, 1)}`} unit="t" label={<span className="inline-flex items-center gap-1.5"><Icon name="clock" size={15} /> {date(F.window_start)} – {date(F.window_end)}</span>} size="lg" className="mt-2" />
        <details className="mt-3"><summary className="text-sm text-text-2">{t("notes")}</summary><p className="pb-2 text-sm text-text-2">{F.advice} {F.note}</p></details>
      </Card>
      <Button variant={listed ? "secondary" : "accent"} size="lg" icon={listed ? "check" : "sell"} full disabled={listed} onClick={() => { act({ type: "listing", payload: {} }); toast(t("offerCreated"), undefined, "check"); }}>{listed ? t("offerPublished") : t("createOffer")}</Button>
    </div>} side={<div>
      <Label className="mb-2 px-1" end={<Badge tone="simulated">{t("buyersSim")}</Badge>}>{t("offers")}</Label>
      <div className="space-y-2.5">
        {O.offers.map((o) => (
          <div key={o.id}>
            <ListItem icon={o.kind === "institution" ? "school" : o.kind === "trader" ? "truck" : "coop"} title={o.buyer}
              sub={<span className="num"><b className="text-xl text-text">{num(o.price_mad_kg, 2)}</b> <span>{t("madKg")}</span>{o.est_value_mad != null && <span className="ms-2 text-text-3">≈ {num(o.est_value_mad)} {t("mad")}</span>}</span>}
              muted={o.status === "declined"}
              end={o.status === "open" ? (confirm === o.id ? undefined : <Button size="sm" variant="secondary" onClick={() => setConfirm(o.id)}>{t("accept")}</Button>) : <Badge tone={o.status === "accepted" ? "success" : "outline"} icon={o.status === "accepted" ? "check" : undefined}>{o.status === "accepted" ? t("accepted") : t("declined")}</Badge>} />
            {confirm === o.id && (
              <div className="anim-fade-up -mt-1 rounded-b-xl border border-t-0 border-line bg-surface-2 p-3">
                <p className="text-sm"><b>{t("acceptQ", { p: num(o.price_mad_kg, 2) })}</b> {t("othersDeclined")}</p>
                <div className="mt-2.5 flex gap-2"><Button variant="primary" size="sm" icon="check" onClick={() => { setConfirm(null); act({ type: "offer_accept", payload: { offer_id: o.id } }); toast(t("offerAccepted"), undefined, "check"); }}>{t("yesAccept")}</Button><Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>{t("no")}</Button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>} />
  </>);
}
