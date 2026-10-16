"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFarm, useT } from "@/lib/farm";
import { Icon } from "@/lib/icons";
import { IMAGERY_ATTR, staticMap, type LatLng } from "@/lib/map";

// The interactive maps are heavy (Leaflet, MapLibre): their code only downloads when that view is opened.
const Loading = () => <MapLoading />;
const Map2D = dynamic(() => import("./map-2d"), { ssr: false, loading: Loading });
const Map3D = dynamic(() => import("./map-3d"), { ssr: false, loading: Loading });

const views = [
  { id: "photo", key: "viewPhoto", icon: "camera" },
  { id: "measure", key: "viewMeasure", icon: "ruler" },
  { id: "3d", key: "view3d", icon: "field-sun" },
] as const;

export default function FieldMap({ center }: { center?: LatLng }) {
  const { profile: p, saveProfile, lang } = useFarm();
  const t = useT();
  const [view, setView] = useState<(typeof views)[number]["id"]>("photo");
  const boundary = p?.boundary;
  const ha = parseFloat(p?.area ?? "");

  function save(pts: LatLng[], m2: number) {
    saveProfile({ ...p!, boundary: pts, area: `${Math.round(m2 / 100) / 100} ha` });
    setView("photo");
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-serif text-3xl">{t("myLand")}</h2>
        {ha > 0 && (
          <p className="text-end">
            <span className="font-serif text-4xl leading-none">{ha.toLocaleString(lang)}</span>{" "}
            <span className="text-lg text-muted">{t("hectares")}</span>
          </p>
        )}
      </div>

      <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-line bg-card p-1">
        {views.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 ${view === v.id ? "bg-leaf text-white" : "text-muted"}`}>
            <Icon name={v.icon} className="h-5 w-5" />{t(v.key)}
          </button>
        ))}
      </div>

      <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-line">
        {!center ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-lg text-muted">{t("noMapLocation")}</p>
        ) : view === "photo" ? (
          <StaticMap center={center} boundary={boundary} onDraw={() => setView("measure")} />
        ) : view === "measure" ? (
          <Map2D center={center} boundary={boundary} onSave={save} />
        ) : (
          <Map3D center={center} boundary={boundary} />
        )}
      </div>
    </section>
  );
}

// Static map: a single satellite image with the field outline drawn over it. No map library, fast on mobile data.
function StaticMap({ center, boundary, onDraw }: { center: LatLng; boundary?: LatLng[]; onDraw: () => void }) {
  const t = useT();
  const { url, outline } = staticMap(center, boundary, 800, 600);
  return (
    <>
      <img src={url} alt="" width={800} height={600} className="h-full w-full object-cover" />
      {outline && (
        <svg viewBox="0 0 800 600" className="absolute inset-0 h-full w-full" aria-hidden>
          <polygon points={outline} fill="rgb(250 204 21 / .2)" stroke="#facc15" strokeWidth={4} strokeLinejoin="round" />
        </svg>
      )}
      {!outline && (
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
          <p className="rounded-xl bg-card/95 px-3 py-2 text-center font-medium">{t("noField")}</p>
          <button type="button" className="btn shadow-lg" onClick={onDraw}>{t("drawField")}</button>
        </div>
      )}
      <span className="absolute end-1 top-1 rounded bg-black/40 px-1.5 text-[10px] text-white">{IMAGERY_ATTR}</span>
    </>
  );
}

function MapLoading() {
  const t = useT();
  return <p className="flex h-full animate-pulse items-center justify-center text-muted">{t("mapLoading")}</p>;
}
