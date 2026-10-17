"use client";
// "My land": the team's interactive maps (3zden). Photo: one satellite image with the outline, no map library. Measure: Leaflet
// with leaflet-measure, big translated buttons. 3D: MapLibre terrain. The heavy libraries only download when their view opens.
// A drawn outline saves the area on the phone and sends it to the engine (farmer profile), so the doses use the real surface.
import dynamic from "next/dynamic";
import { useState } from "react";
import { useActions } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { IMAGERY_ATTR, staticMap, type LatLng } from "@/lib/map";
import { Badge, Button, Segmented } from "@/components/ui";

const Loading = () => <MapLoading />;
const Map2D = dynamic(() => import("./Map2D"), { ssr: false, loading: Loading });
const Map3D = dynamic(() => import("./Map3D"), { ssr: false, loading: Loading });
type View = "photo" | "measure" | "3d";

export default function FieldMap({ center, fallbackHa }: { center?: LatLng; fallbackHa?: number }) {
  const { profile: p, saveProfile, lang } = useFarm();
  const { act } = useActions();
  const t = useT();
  const [view, setView] = useState<View>("photo");
  const boundary = p?.boundary;
  const ha = parseFloat(p?.area ?? "") || fallbackHa || 0;

  function save(pts: LatLng[], m2: number) {
    const area = Math.round(m2 / 100) / 100;
    saveProfile({ ...(p ?? { location: "", crop: "", plantedOn: "", area: "", irrigation: "", challenge: "" }), boundary: pts, area: `${area} ha` });
    act({ type: "farmer", payload: { area_ha: area, lat: pts[0][0], lon: pts[0][1] } });   // the engine spreads the surface over the zones
    setView("photo");
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
        <h3 className="font-display text-xl">{t("myLand")}</h3>
        {ha > 0 && <p className="text-end"><span className="font-display num text-3xl leading-none">{ha.toLocaleString(lang === "ar" || lang === "ary" ? "ar-MA-u-nu-latn" : lang)}</span> <span className="text-sm text-text-2">{t("hectares")}</span></p>}
      </div>
      <Segmented<View> label={t("myLand")} size="sm" grow value={view} onChange={setView} options={[{ id: "photo", label: t("viewPhoto"), icon: "camera" }, { id: "measure", label: t("viewMeasure"), icon: "walk" }, { id: "3d", label: t("view3d"), icon: "satellite" }]} />
      <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-2">
        {!center ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-base text-text-2">{t("noMapLocation")}</p>
        ) : view === "photo" ? (
          <StaticMap center={center} boundary={boundary} onDraw={() => setView("measure")} />
        ) : view === "measure" ? (
          <Map2D center={center} boundary={boundary} onSave={save} />
        ) : (
          <Map3D center={center} boundary={boundary} />
        )}
      </div>
      {p?.boundary?.length ? <p className="mt-2 text-xs text-text-3">{t("outlineUsed")}</p> : null}
    </section>
  );
}

function StaticMap({ center, boundary, onDraw }: { center: LatLng; boundary?: LatLng[]; onDraw: () => void }) {
  const t = useT();
  const { url, outline } = staticMap(center, boundary, 800, 600);
  return (<>
    <img src={url} alt="" width={800} height={600} className="h-full w-full object-cover" />
    {outline && <svg viewBox="0 0 800 600" className="absolute inset-0 h-full w-full" aria-hidden><polygon points={outline} fill="rgb(224 154 46 / .25)" stroke="var(--color-accent)" strokeWidth={4} strokeLinejoin="round" /></svg>}
    {!outline && (
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
        <p className="rounded-lg bg-surface/95 px-3 py-2 text-center text-sm font-medium">{t("noField")}</p>
        <Button variant="accent" icon="walk" onClick={onDraw} className="shadow-2">{t("drawField")}</Button>
      </div>
    )}
    <Badge className="absolute end-2 top-2 !bg-black/50 !text-white">{IMAGERY_ATTR}</Badge>
  </>);
}

function MapLoading() {
  const t = useT();
  return <p className="flex h-full animate-pulse items-center justify-center text-text-2">{t("mapLoading")}</p>;
}
