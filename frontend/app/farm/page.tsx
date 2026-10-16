"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { daysSince, today, useFarm } from "@/lib/farm";

type Weather = { place: string; temp: number; days: { date: string; max: number; min: number; rain: number }[] };

// Open-Meteo: free, keyless. Geocodes the free-text location, then fetches a 3-day forecast.
async function getWeather(location: string): Promise<Weather | null> {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(location.split(",")[0])}`).then((r) => r.json());
  const g = geo.results?.[0];
  if (!g) return null;
  const f = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=3&timezone=auto`).then((r) => r.json());
  return {
    place: `${g.name}${g.country ? `, ${g.country}` : ""}`,
    temp: Math.round(f.current.temperature_2m),
    days: f.daily.time.map((date: string, i: number) => ({
      date, max: Math.round(f.daily.temperature_2m_max[i]), min: Math.round(f.daily.temperature_2m_min[i]), rain: f.daily.precipitation_sum[i],
    })),
  };
}

const short = (d: string) => new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekday = (d: string) => new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: "short" });
const rainText = (mm: number) => (mm > 0 ? `${mm} mm rain` : "dry");

export default function MyFarm() {
  const { profile: p, tasks, activities, toggleTask } = useFarm();
  const [weather, setWeather] = useState<Weather | null | "error">();

  useEffect(() => {
    if (p?.location) getWeather(p.location).then(setWeather, () => setWeather("error"));
  }, [p?.location]);

  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const due = open.filter((t) => t.due <= today());
  const later = open.filter((t) => t.due > today());
  const recentlyDone = tasks.filter((t) => t.done).slice(0, 3);
  const field = [p?.area, p?.irrigation && (p.irrigation === "rain-fed" ? "rain-fed" : `${p.irrigation} irrigation`), p?.location && `in ${p.location}`]
    .filter(Boolean).join(", ");

  return (
    <div className="grid gap-x-16 gap-y-12 pt-4 lg:grid-cols-2">
      <div className="space-y-12">
        <section>
          <h1 className="font-serif text-5xl leading-none capitalize md:text-6xl">{p?.crop || "Your farm"}</h1>
          <p className="mt-3 text-lg text-muted">
            {p?.plantedOn ? `Week ${Math.floor(daysSince(p.plantedOn) / 7) + 1} since planting` : "Planting date not set"}
          </p>
          <p className="mt-1 text-muted">
            {field ? <span className="first-letter:uppercase inline-block">{field}</span> : "Field details not set"}{" "}
            <Link href="/?edit" className="font-medium text-leaf underline underline-offset-4">Edit</Link>
          </p>
        </section>

        <section aria-labelledby="weather">
          <h2 id="weather" className="sr-only">Weather</h2>
          {!p?.location ? (
            <p className="text-muted">Add your farm's town to see rain and temperature. <Link href="/?edit" className="font-medium text-leaf underline underline-offset-4">Add location</Link></p>
          ) : weather === undefined ? (
            <p className="animate-pulse text-muted">Getting the forecast…</p>
          ) : weather === null || weather === "error" ? (
            <p className="text-muted">No forecast found for “{p.location}”. Try the nearest town name.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-4">
                <span className="font-serif text-6xl leading-none">{weather.temp}°</span>
                <span className="text-lg">Today, {rainText(weather.days[0].rain)}</span>
              </div>
              <ul className="mt-4 flex gap-6 text-muted">
                {weather.days.slice(1).map((d) => (
                  <li key={d.date}><span className="font-medium text-ink">{weekday(d.date)}</span> {d.max}°/{d.min}°, {rainText(d.rain)}</li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-muted">{weather.place}</p>
              <Link href={{ pathname: "/copilot", query: { q: "Should I irrigate today?" } }}
                className="mt-4 inline-block font-medium text-leaf underline underline-offset-4">Should I irrigate today?</Link>
            </>
          )}
        </section>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="font-serif text-2xl">Today</h2>
          {due.length === 0 && recentlyDone.length === 0 ? (
            <p className="mt-3 text-muted">
              Nothing to do today.{" "}
              <Link href={{ pathname: "/copilot", query: { q: "What should I do on the farm today?" } }} className="font-medium text-leaf underline underline-offset-4">Ask what to check</Link>
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {due.map((t) => <TaskRow key={t.id} t={t} overdue={t.due < today()} onToggle={toggleTask} />)}
              {recentlyDone.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleTask} />)}
            </ul>
          )}
        </section>

        {later.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl">Coming up</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">{later.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleTask} />)}</ul>
          </section>
        )}

        <section>
          <h2 className="font-serif text-2xl">Recently done</h2>
          {activities.length === 0 ? (
            <p className="mt-3 text-muted">Nothing recorded yet. Records help the Co-Pilot give better advice.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {activities.slice(0, 4).map((a) => (
                <li key={a.id} className="flex justify-between gap-4 py-3">
                  <span><span className="font-medium capitalize">{a.type}</span>{a.note && <span className="text-muted">, {a.note}</span>}</span>
                  <span className="shrink-0 text-muted">{short(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/activities" className="mt-3 inline-block font-medium text-leaf underline underline-offset-4">Record an activity</Link>
        </section>
      </div>
    </div>
  );
}

function TaskRow({ t, overdue, onToggle }: { t: { id: string; title: string; due: string; done: boolean }; overdue?: boolean; onToggle: (id: string) => void }) {
  return (
    <li className="py-1">
      <label className="flex cursor-pointer items-start gap-4 py-2.5">
        <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} className="mt-0.5 h-6 w-6 shrink-0 accent-leaf" />
        <span className="flex-1">
          <span className={`block text-lg leading-snug ${t.done ? "text-muted line-through" : ""}`}>{t.title}</span>
          <span className={`text-sm ${overdue ? "font-medium text-sun" : "text-muted"}`}>{overdue ? `Overdue since ${short(t.due)}` : short(t.due)}</span>
        </span>
      </label>
      {t.done && (
        <Link href={`/activities?note=${encodeURIComponent(t.title)}`} className="mb-2 ml-10 inline-block text-sm font-medium text-leaf underline underline-offset-4">
          Record what you did
        </Link>
      )}
    </li>
  );
}
