"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { daysSince, today, useFarm, useT, useTx, type Profile, type Task } from "@/lib/farm";
import { activityTypes, cropIcon, cropName, intlLocale, irrigations } from "@/lib/i18n";
import { Icon } from "@/lib/icons";
import { PhotoCardBody, photoCard, starters } from "@/lib/starters";
import EngineCard from "./engine-card";
import FieldMap from "./field-map";

type Weather = { lat: number; lon: number; place: string; temp: number; days: { date: string; max: number; min: number; rain: number; code: number }[] };

// Open-Meteo: free, keyless. Uses GPS coordinates when the farmer shared them, else geocodes the town name.
async function getWeather(p: Profile, lang: string): Promise<Weather | null> {
  let lat = p.lat, lon = p.lon, place = p.location;
  if (lat === undefined || lon === undefined) {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=${lang}&name=${encodeURIComponent(p.location.split(",")[0])}`).then((r) => r.json());
    const g = geo.results?.[0];
    if (!g) return null;
    ({ latitude: lat, longitude: lon } = g);
    place = `${g.name}${g.country ? `, ${g.country}` : ""}`;
  }
  const f = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&forecast_days=3&timezone=auto`).then((r) => r.json());
  return {
    lat: lat!, lon: lon!,
    place,
    temp: Math.round(f.current.temperature_2m),
    days: f.daily.time.map((date: string, i: number) => ({
      date, max: Math.round(f.daily.temperature_2m_max[i]), min: Math.round(f.daily.temperature_2m_min[i]),
      rain: f.daily.precipitation_sum[i], code: f.daily.weather_code[i],
    })),
  };
}

// WMO weather codes → a picture anyone can read.
const sky = (c: number) => c === 0 ? "field-sun" : c <= 2 ? "cloud-sun" : c === 3 ? "cloud" : c <= 48 ? "fog" : c <= 67 || (c >= 80 && c <= 82) ? "rain" : c <= 86 ? "snow" : "storm";

export default function MyFarm() {
  const { profile: p, sync, tasks, activities, toggleTask, lang } = useFarm();
  const t = useT();
  const tx = useTx();
  const [weather, setWeather] = useState<Weather | null | "error">();
  const day = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00`).toLocaleDateString(intlLocale(lang), o);
  const short = (d: string) => day(d, { month: "short", day: "numeric" });
  const rain = (mm: number) => (mm > 0 ? t("rainMm", { mm }) : t("dry"));

  useEffect(() => {
    if (p?.location) getWeather(p, lang).then(setWeather, () => setWeather("error"));
  }, [p?.location, p?.lat, p?.lon, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = tasks.filter((x) => !x.done).sort((a, b) => a.due.localeCompare(b.due));
  const due = open.filter((x) => x.due <= today());
  const later = open.filter((x) => x.due > today());
  const recentlyDone = tasks.filter((x) => x.done).slice(0, 3);
  const irr = irrigations.find((i) => i.id === p?.irrigation);
  const facts = [
    p?.crop && [cropIcon(p.crop), cropName(lang, p.crop)],
    p?.area && ["ruler", p.area.replace("ha", t("hectares"))],
    irr && [irr.icon, t(irr.key)],
    p?.location && ["pin", p.location],
  ].filter(Boolean) as [string, string][];

  // What the engine did with the answers: honest about what it used and what it did not (for example: still the demo parcel).
  const used = Object.keys(sync?.applied ?? {}).map((k) => ({ crop: t("m_crop"), sowing_date: t("m_planted"), area_ha: t("m_area"), position: t("m_position") })[k as "crop"]).filter(Boolean);
  const engineNotes = sync ? (
    <div className="mt-4 space-y-1.5 text-base text-muted" aria-live="polite">
      {sync.pending && <p className="flex items-center gap-2"><Icon name="hourglass" className="h-4 w-4 shrink-0" />{t("waitingSync")}</p>}
      {!sync.pending && used.length > 0 && <p className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 shrink-0 text-leaf" />{t("profileApplied", { what: used.join(", ") })}</p>}
      {!sync.pending && (sync.notApplied ?? []).map((n) => <p key={n} className="flex items-start gap-2"><Icon name="alert" className="mt-1 h-4 w-4 shrink-0 text-sun" />{n}</p>)}
    </div>
  ) : null;

  const taskRow = (x: Task, overdue = false) => (
    <li key={x.id} className="py-1">
      <label className="flex cursor-pointer items-start gap-4 py-2.5">
        <input type="checkbox" checked={x.done} onChange={() => toggleTask(x.id)} className="mt-0.5 h-7 w-7 shrink-0 accent-leaf" />
        <span className="flex-1">
          <span className={`block text-lg leading-snug ${x.done ? "text-muted line-through" : ""}`}>{tx(x.title)}</span>
          <span className={`flex items-center gap-1 ${overdue ? "font-medium text-sun" : "text-muted"}`}>{overdue && <Icon name="alert" className="h-4 w-4" />}{overdue ? `${t("late")}, ${short(x.due)}` : short(x.due)}</span>
        </span>
      </label>
      {x.done && (
        <Link href={`/activities?note=${encodeURIComponent(tx(x.title))}`} className="mb-2 ms-11 inline-block font-medium text-leaf underline underline-offset-4">
          {t("recordWhat")}
        </Link>
      )}
    </li>
  );

  return (
    <div className="pt-4">
    <EngineCard />
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
      <div className="space-y-12">
        <section>
          <img src="/images/field-drip.webp" alt="" width={960} height={640} className="mb-6 aspect-[21/9] w-full rounded-2xl object-cover" />
          <h1 className="font-serif text-5xl leading-none md:text-6xl">{t("myField")}</h1>
          <p className="mt-3 text-lg text-muted">
            {p?.plantedOn ? t("weekN", { n: Math.floor(daysSince(p.plantedOn) / 7) + 1 }) : t("plantingUnknown")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-lg">
            {facts.map(([icon, label]) => <li key={icon} className="flex items-center gap-2"><Icon name={icon} className="h-5 w-5 text-muted" />{label}</li>)}
            <li><Link href="/?edit" className="inline-flex items-center gap-1 font-medium text-leaf underline underline-offset-4"><Icon name="pencil" className="h-4 w-4" />{t("edit")}</Link></li>
          </ul>
          {engineNotes}
        </section>

        <FieldMap center={p?.lat !== undefined && p.lon !== undefined ? [p.lat, p.lon] : weather && weather !== "error" ? [weather.lat, weather.lon] : undefined} />

        <section aria-label={t("today")}>
          {!p?.location ? (
            <p className="text-muted">{t("addLocation")} <Link href="/?edit" className="font-medium text-leaf underline underline-offset-4">{t("edit")}</Link></p>
          ) : weather === undefined ? (
            <p className="animate-pulse text-muted">{t("loadingWeather")}</p>
          ) : weather === null || weather === "error" ? (
            <p className="text-muted">{t("noWeather", { place: p.location })}</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Icon name={sky(weather.days[0].code)} className="h-14 w-14" />
                <span className="font-serif text-6xl leading-none">{weather.temp}°</span>
                <span className="text-lg">{t("today")}<br />{rain(weather.days[0].rain)}</span>
              </div>
              <ul className="mt-5 flex gap-8 text-lg">
                {weather.days.slice(1).map((d) => (
                  <li key={d.date} className="flex items-center gap-2">
                    <Icon name={sky(d.code)} className="h-8 w-8 text-muted" />
                    <span><span className="font-medium">{day(d.date, { weekday: "short" })}</span> {d.max}°<br /><span className="text-muted">{rain(d.rain)}</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h2 className="font-serif text-3xl">{t("askCopilot")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {starters.map((s) => (
              <Link key={s.title} href={{ pathname: "/copilot", query: { q: t(s.q), ask: 1 } }} className={photoCard}>
                <PhotoCardBody s={s} label={t(s.title)} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="font-serif text-3xl">{t("today")}</h2>
          {due.length === 0 && recentlyDone.length === 0 ? (
            <p className="mt-3 text-lg text-muted">
              {t("nothingToday")}{" "}
              <Link href={{ pathname: "/copilot", query: { q: t("askWhatQ") } }} className="font-medium text-leaf underline underline-offset-4">{t("askWhat")}</Link>
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {due.map((x) => taskRow(x, x.due < today()))}
              {recentlyDone.map((x) => taskRow(x))}
            </ul>
          )}
        </section>

        {later.length > 0 && (
          <section>
            <h2 className="font-serif text-3xl">{t("comingUp")}</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">{later.map((x) => taskRow(x))}</ul>
          </section>
        )}

        <section>
          <h2 className="font-serif text-3xl">{t("recentlyDone")}</h2>
          {activities.length === 0 ? (
            <p className="mt-3 text-lg text-muted">{t("nothingRecorded")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {activities.slice(0, 4).map((a) => {
                const type = activityTypes.find((x) => x.id === a.type)!;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-lg">
                    <span className="flex items-center gap-3">
                      <Icon name={type.icon} className="h-6 w-6 text-leaf" />
                      <span>{t(type.key)}{a.note && <span className="text-muted">, {a.note}</span>}</span>
                    </span>
                    <span className="shrink-0 text-muted">{short(a.date)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/activities" className="mt-4 inline-block font-medium text-leaf underline underline-offset-4">{t("recordWhat")}</Link>
        </section>
      </div>
    </div>
    </div>
  );
}
