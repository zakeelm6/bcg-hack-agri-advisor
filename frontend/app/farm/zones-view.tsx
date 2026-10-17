"use client";

import { API } from "@/lib/api";
import { useFarm, useT } from "@/lib/farm";
import { useFieldView, vigorLevel, type Zone } from "@/lib/field";
import { Icon } from "@/lib/icons";

// "My land" from the engine's point of view: the satellite picture around the field, the four zones on it coloured by vigor
// (a word and a number as well as the colour), and the spots that stay below their own normal. Honest about what is missing:
// the demo parcel, a picture still being downloaded, a download that failed.
const FILL = { good: "rgb(47 107 58 / .55)", medium: "rgb(201 130 31 / .55)", weak: "rgb(160 50 40 / .55)", unknown: "rgb(110 110 110 / .35)" } as const;
const WORD = { good: "vigorGood", medium: "vigorMedium", weak: "vigorWeak", unknown: "vigorUnknown" } as const;

export default function ZonesView() {
  const { lang } = useFarm();
  const t = useT();
  const { info, data, stale, retry } = useFieldView(lang);

  if (!API) return <p className="flex h-full items-center justify-center p-6 text-center text-lg text-muted">{t("satNone")}</p>;
  if (!info || !data) return <p className="flex h-full animate-pulse items-center justify-center text-muted">{t("mapLoading")}</p>;

  const pic = info.picture;
  const size = 74;                                                      // the field's square, in % of the box (the picture is zoomed to fit it)
  const origin = (100 - size) / 2;
  const zoom = pic ? size / ((pic.field_side_m / pic.side_m) * 100) : 1;   // how many times the picture is larger than the box
  const grid = data.grid;
  const fmt = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString(lang === "ar" || lang === "ary" ? "ar-MA-u-nu-latn" : lang, { month: "short", day: "numeric" });
  const label = (z: Zone) => `${t("zoneN", { z: z.code })}: ${t(WORD[vigorLevel(z.ndvi)])}${z.ndvi != null ? ` ${z.ndvi.toFixed(2)}` : ""}`;

  return (
    <div className="flex h-full flex-col">
      <div className="relative mx-auto aspect-square h-full max-h-full overflow-hidden bg-line" style={{ aspectRatio: "1 / 1" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {pic && <img src={`${API}/field/picture?d=${pic.date}`} alt="" className="absolute max-w-none" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, left: `${50 - zoom * 50}%`, top: `${50 - zoom * 50}%` }} />}
        <div className="absolute" style={{ left: `${origin}%`, top: `${origin}%`, width: `${size}%`, height: `${size}%` }}>
          {data.zones.map((z) => (
            <div key={z.code} role="img" aria-label={label(z)} className="absolute flex flex-col items-center justify-center border border-white/90 text-white"
              style={{ left: `${z.col * 50}%`, top: `${z.row * 50}%`, width: "50%", height: "50%", background: FILL[vigorLevel(z.ndvi)] }}>
              <span className="absolute start-1.5 top-0.5 text-sm font-bold drop-shadow">{z.code}</span>
              <span className="font-serif text-xl font-semibold leading-none drop-shadow sm:text-2xl">{z.ndvi != null ? z.ndvi.toFixed(2) : "?"}</span>
              <span className="mt-0.5 text-[11px] font-medium leading-tight drop-shadow sm:text-xs">{t(WORD[vigorLevel(z.ndvi)])}</span>
            </div>
          ))}
          {grid && data.spots.flatMap((s, i) => (s.properties.cells ?? []).map(([r, c]) => (
            <span key={`${i}-${r}-${c}`} className="pointer-events-none absolute border-2 border-dashed border-white"
              style={{ left: `${(c / grid.cols) * 100}%`, top: `${(r / grid.rows) * 100}%`, width: `${100 / grid.cols}%`, height: `${100 / grid.rows}%` }} />
          )))}
          <span className="pointer-events-none absolute inset-0 border-2 border-dashed border-white" />
        </div>
        {pic && <span className="absolute end-1 top-1 rounded bg-black/40 px-1.5 text-[10px] text-white">{t("pictureFrom", { d: fmt(pic.date) })}</span>}
      </div>
      <div className="space-y-1.5 bg-card px-3 py-2 text-base">
        {data.spots.length > 0 && <p className="flex items-center gap-2"><span className="inline-block h-4 w-4 shrink-0 border-2 border-dashed border-ink" />{t("spotLegend")}</p>}
        {info.source === "demo" && <p className="flex items-start gap-2 text-muted"><Icon name="alert" className="mt-1 h-4 w-4 shrink-0 text-sun" />{t("demoParcel")}</p>}
        {info.source === "own" && info.satellite_status === "pending" && <p className="flex items-start gap-2 text-muted"><Icon name="hourglass" className="mt-1 h-4 w-4 shrink-0" />{t("satPending")}</p>}
        {info.source === "own" && (info.satellite_status === "failed" || info.satellite_status === "none") && (
          <p className="flex flex-wrap items-start gap-x-3 gap-y-1 text-muted">
            <span className="flex items-start gap-2"><Icon name="alert" className="mt-1 h-4 w-4 shrink-0 text-sun" />{t(info.satellite_status === "failed" ? "satFailed" : "satNone")} {info.satellite_note}</span>
            {info.satellite_status === "failed" && <button type="button" onClick={retry} className="font-medium text-leaf underline underline-offset-4">{t("tryAgain")}</button>}
          </p>
        )}
        {stale && <p className="text-muted">{t("savedAdvice")}</p>}
      </div>
    </div>
  );
}
