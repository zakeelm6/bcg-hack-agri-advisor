import { daysSince, type Activity, type Advice, type Profile, type Task } from "./farm";

export type Context = { profile: Profile; activities: Activity[]; tasks: Task[] };

// Calls the backend AI orchestrator when NEXT_PUBLIC_API_URL is set; otherwise a local rule-based stand-in
// so the full onboarding → advice → task → log → follow-up loop is demoable without a backend.
export async function askCopilot(question: string, photo: string | undefined, ctx: Context): Promise<Advice> {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) {
    const res = await fetch(`${api}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, photo, context: ctx }),
    });
    if (!res.ok) throw new Error(`Co-Pilot error ${res.status}`);
    return res.json();
  }
  await new Promise((r) => setTimeout(r, 700));
  return mockAdvice(question, !!photo, ctx);
}

const ago = (d: string) => ({ 0: "today", 1: "yesterday" } as Record<number, string>)[daysSince(d)] ?? `${daysSince(d)} days ago`;

// ponytail: keyword matching, not reasoning. Replaced entirely by the LLM backend.
export function mockAdvice(q: string, hasPhoto: boolean, { profile: p, activities, tasks }: Context): Advice {
  const text = q.toLowerCase();
  const crop = p.crop || "your crop";
  const missing: string[] = [];
  if (!p.crop) missing.push("main crop");
  if (!p.plantedOn) missing.push("planting date");
  if (!p.irrigation) missing.push("irrigation method");
  const age = p.plantedOn ? `${Math.floor(daysSince(p.plantedOn) / 7)} weeks after planting` : "an unknown growth stage";
  const last = (t: Activity["type"]) => activities.find((a) => a.type === t);

  if (hasPhoto || /leaf|leaves|yellow|spot|pest|disease|insect|wilt|problem|sick/.test(text)) {
    const treat = last("treatment");
    return {
      recommendation: `Inspect more ${crop} plants before treating anything.`,
      why: `A single ${hasPhoto ? "photo" : "description"} can't confirm a cause. Yellowing or spots on ${crop} at ${age} can come from water stress, nutrient deficiency, pests or disease — each needs a different response.${treat ? ` Your last recorded treatment was ${ago(treat.date)} (${treat.note || "no details"}), so rule out a reaction to it.` : ""}`,
      steps: [
        "Check 10 plants across the field: is the symptom on old leaves, new leaves, or both?",
        "Look under leaves and on stems for insects or eggs.",
        "Check soil moisture at the roots of an affected plant.",
        "If more than a few plants are affected, show a sample to a local agronomist before spraying.",
      ],
      missing: [...missing, ...(hasPhoto ? ["close-up of the underside of a leaf"] : ["a crop photo"])],
    };
  }
  if (/task|today|plan|to do|todo/.test(text) && !/irrigat|water/.test(text)) {
    const open = tasks.filter((t) => !t.done && t.due <= new Date().toISOString().slice(0, 10));
    return {
      recommendation: open.length ? `Start with: ${open[0].title}` : `No tasks due — a quick walk through your ${crop} is a good use of today.`,
      why: open.length
        ? `You have ${open.length} task(s) due or overdue. Clearing the oldest first keeps small problems from growing.`
        : `Regular field checks catch water stress, pests and disease early, when they're cheapest to fix.${p.challenge ? ` You said ${p.challenge} is your main challenge, so look for that first.` : ""}`,
      steps: open.length
        ? [...open.slice(0, 3).map((t) => t.title), "Tick tasks off on My Farm and record what you did."]
        : ["Walk the field and check 10 plants.", "Check soil moisture at root depth.", "Ask me about anything unusual you see."],
      missing,
    };
  }
  if (/cost|expense|spend|money|profit|price/.test(text)) {
    const exp = activities.filter((a) => a.type === "expense");
    const total = exp.reduce((s, a) => s + (a.cost ?? 0), 0);
    return {
      recommendation: exp.length ? `You've recorded ${total.toLocaleString()} in expenses across ${exp.length} entries.` : "Start recording expenses so I can track your costs.",
      why: exp.length
        ? `Your biggest recorded expense is "${[...exp].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0].note || "unnamed"}". Knowing where money goes is the first step to cutting it.`
        : "Without recorded expenses I can only guess. Even rough numbers for seed, fertilizer, water and labour help.",
      steps: ["Log every purchase in Activities with its cost.", "Group costs by input: seed, fertilizer, water, labour.", "Ask me again once a week to compare."],
      missing: [...missing, ...(exp.length ? [] : ["expense records"]), "expected yield and selling price"],
    };
  }
  if (/fertili[sz]|nitrogen|npk|manure|nutrient/.test(text)) {
    return {
      recommendation: `Get a soil test before your next fertilizer application on ${crop}.`,
      why: `Fertilizer needs depend on soil nutrients and growth stage (${age}). Applying without a test risks wasting money or burning roots.`,
      steps: ["Take soil samples from 5–10 spots and mix them.", "Send to a local lab or extension office.", "Record the result here so I can suggest amounts."],
      missing: [...missing, "soil test results"],
    };
  }
  // Default: water & irrigation, the most common daily decision.
  const irr = last("irrigation");
  return {
    recommendation: irr && daysSince(irr.date) <= 1
      ? `Hold off irrigating today — you watered ${daysSince(irr.date) === 0 ? "today" : "yesterday"}.`
      : `Check soil moisture before irrigating ${crop} today.`,
    why: `${crop} at ${age}${p.area ? ` on ${p.area}` : ""} with ${p.irrigation || "an unknown irrigation method"}. ${irr ? `Your last recorded irrigation was ${ago(irr.date)}${irr.note ? ` (${irr.note})` : ""}.` : "I don't have any irrigation records yet, so I can't tell when the field was last watered."} Recent weather also matters — check the forecast on My Farm.`,
    steps: [
      "Dig 10–15 cm near the root zone and squeeze a handful of soil.",
      "If it holds together and feels damp, wait another day.",
      "If it crumbles dry, irrigate and record the amount in Activities.",
    ],
    missing: [...missing, ...(irr ? [] : ["irrigation records"]), "soil type"],
  };
}
