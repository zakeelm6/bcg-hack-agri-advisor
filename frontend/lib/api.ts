// The backend (decision engine, Copilot, voice). Set NEXT_PUBLIC_API_URL (see .env.example); without it the app works on its own,
// with the answers and data kept on the phone, as before.
export const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, ms = 8000): Promise<T> {
  if (!API) throw new Error("no backend configured");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export const get = <T,>(path: string, ms?: number) => request<T>("GET", path, undefined, ms);
export const post = <T,>(path: string, body: unknown, ms?: number) => request<T>("POST", path, body, ms);

/** Safe to retry later: the phone was offline or the server was down (not a refusal by the server). */
export const unreachable = (e: unknown) =>
  e instanceof TypeError || (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"));
