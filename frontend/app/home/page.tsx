// Server component: fetches the first state so the "Do this now" card is in the HTML (fast first paint on a slow phone).
// The API is reached server-side at API_URL (defaults to the local backend); failures fall back to client fetching.
import type { StateOut } from "@/lib/api";
import Home from "./Home";

export const dynamic = "force-dynamic";

export default async function Page() {
  let initial: StateOut | null = null;
  try {
    const r = await fetch(`${process.env.API_URL ?? "http://127.0.0.1:8000"}/api/state?lang=en`, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (r.ok) initial = (await r.json()) as StateOut;
  } catch { /* offline or no backend: the client loads from its copy */ }
  return <Home initial={initial} />;
}
