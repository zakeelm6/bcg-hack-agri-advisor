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

  return (
    <div className="grid gap-5 pt-2 lg:grid-cols-2 lg:items-start">
      <h1 className="font-serif text-3xl lg:col-span-2">My Farm</h1>

      <section className="card">
        <div className="flex items-start justify-between">
          <div>
            <p className="label">Main crop</p>
            <p className="mt-1 font-serif text-2xl capitalize">{p?.crop || "Not set"}</p>
          </div>
          <Link href="/" className="text-sm font-medium text-leaf">Edit</Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Info k="Planted" v={p?.plantedOn ? `${p.plantedOn} · ${Math.floor(daysSince(p.plantedOn) / 7)} wks ago` : ""} />
          <Info k="Field area" v={p?.area} />
          <Info k="Irrigation" v={p?.irrigation} />
          <Info k="Focus" v={p?.challenge} />
          <Info k="Location" v={p?.location} />
        </dl>
      </section>

      <section>
        <h2 className="label mb-2">Today's tasks</h2>
        <div className="card divide-y divide-line p-0">
          {due.length === 0 && <p className="p-4 text-muted">Nothing due. Save advice from the Co-Pilot to add tasks.</p>}
          {due.map((t) => <TaskRow key={t.id} t={t} overdue={t.due < today()} onToggle={toggleTask} />)}
          {recentlyDone.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleTask} />)}
        </div>
        {later.length > 0 && (
          <>
            <h2 className="label mt-4 mb-2">Coming up</h2>
            <div className="card divide-y divide-line p-0">{later.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleTask} />)}</div>
          </>
        )}
      </section>

      <section>
        <h2 className="label mb-2">Weather</h2>
        <div className="card">
          {!p?.location ? (
            <p className="text-muted">Add your farm location to see the forecast.</p>
          ) : weather === undefined ? (
            <p className="animate-pulse text-muted">Loading forecast…</p>
          ) : weather === null || weather === "error" ? (
            <p className="text-muted">Couldn't get a forecast for “{p.location}”. Try a nearby town name.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl">{weather.temp}°C</span>
                <span className="text-sm text-muted">{weather.place}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                {weather.days.map((d, i) => (
                  <div key={d.date} className="rounded-xl bg-paper py-2">
                    <div className="font-medium">{i === 0 ? "Today" : new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div>{d.max}° / {d.min}°</div>
                    <div className={d.rain > 0 ? "text-leaf" : "text-muted"}>{d.rain} mm</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="label">Recent activity</h2>
          <Link href="/activities" className="text-sm font-medium text-leaf">Record</Link>
        </div>
        <div className="card divide-y divide-line p-0">
          {activities.length === 0 && <p className="p-4 text-muted">No activities recorded yet.</p>}
          {activities.slice(0, 4).map((a) => (
            <div key={a.id} className="flex justify-between gap-3 p-4 text-sm">
              <span><span className="font-medium capitalize">{a.type}</span>{a.note && <span className="text-muted"> · {a.note}</span>}</span>
              <span className="shrink-0 text-muted">{a.date}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className={`first-letter:uppercase ${v ? "" : "text-muted/60"}`}>{v || "—"}</dd>
    </div>
  );
}

function TaskRow({ t, overdue, onToggle }: { t: { id: string; title: string; due: string; done: boolean }; overdue?: boolean; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-leaf" aria-label={`Done: ${t.title}`} />
      <div className="flex-1">
        <p className={t.done ? "text-muted line-through" : ""}>{t.title}</p>
        <p className={`text-xs ${overdue ? "text-sun" : "text-muted"}`}>{overdue ? "Overdue · " : ""}{t.due}</p>
        {t.done && (
          <Link href={`/activities?note=${encodeURIComponent(t.title)}`} className="mt-1 inline-block text-sm font-medium text-leaf">
            Record what you did →
          </Link>
        )}
      </div>
    </div>
  );
}
