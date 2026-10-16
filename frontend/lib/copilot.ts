import { daysSince, type Activity, type Advice, type Profile, type Task } from "./farm";
import { cropName, tr, type Key, type Lang } from "./i18n";

export type Context = { profile: Profile; activities: Activity[]; tasks: Task[] };

// Calls the backend AI orchestrator when NEXT_PUBLIC_API_URL is set; otherwise a local rule-based stand-in
// so the full onboarding → advice → task → log → follow-up loop is demoable without a backend.
// `lang` tells the backend which language to answer in (en | fr | ar).
export async function askCopilot(question: string, photo: string | undefined, ctx: Context, lang: Lang): Promise<Advice> {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) {
    const res = await fetch(`${api}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, photo, context: ctx, lang }),
    });
    if (!res.ok) throw new Error(`Co-Pilot error ${res.status}`);
    return res.json();
  }
  await new Promise((r) => setTimeout(r, 700));
  return mockAdvice(question, !!photo, ctx, lang);
}

// ponytail: keyword matching in en/fr/ar, not reasoning. Replaced entirely by the LLM backend.
const PEST = /leaf|leaves|yellow|spot|pest|disease|insect|wilt|problem|sick|feuille|jaun|tache|malad|insecte|ورق|أوراق|تصفر|اصفر|مرض|حشر|بقع/;
const WATER = /irrigat|water|arros|eau|سقي|أسقي|ماء/;
const TASKS = /task|today|plan|to do|todo|tâche|aujourd|faire|مهم|اليوم|أفعل/;
const COST = /cost|expense|spend|money|profit|price|coût|dépens|argent|prix|مصاريف|مصروف|تكلف|مال|ثمن|سعر/;
const FERT = /fertili[sz]|nitrogen|npk|manure|nutrient|engrais|fumier|سماد|أسمدة/;

export function mockAdvice(q: string, hasPhoto: boolean, { profile: p, activities, tasks }: Context, lang: Lang): Advice {
  const t = (k: Key, v?: Record<string, string | number>) => tr(lang, k, v);
  const text = q.toLowerCase();
  const crop = p.crop ? cropName(lang, p.crop).toLowerCase() : t("yourCrop");
  const age = p.plantedOn ? t("weeksAfter", { n: Math.floor(daysSince(p.plantedOn) / 7) }) : t("unknownStage");
  const ago = (d: string) => { const n = daysSince(d); return n === 0 ? t("ago_0") : n === 1 ? t("ago_1") : t("agoN", { n }); };
  const last = (type: Activity["type"]) => activities.find((a) => a.type === type);
  const missing: string[] = [];
  if (!p.crop) missing.push(t("m_crop"));
  if (!p.plantedOn) missing.push(t("m_planted"));
  if (!p.irrigation) missing.push(t("m_irrigation"));

  if (hasPhoto || PEST.test(text)) {
    const treat = last("treatment");
    return {
      recommendation: t("pestRec", { crop }),
      why: t("pestWhy", { src: t(hasPhoto ? "src_photo" : "src_desc") }) + (treat ? t("pestWhyTreat", { when: ago(treat.date) }) : ""),
      steps: [t("pest1"), t("pest2"), t("pest3")],
      icons: ["search", "bug", "chat"],
      missing: [...missing, t(hasPhoto ? "m_photoUnder" : "m_photo")],
    };
  }
  if (TASKS.test(text) && !WATER.test(text)) {
    const open = tasks.filter((x) => !x.done && x.due <= new Date().toISOString().slice(0, 10));
    return open.length
      ? {
          recommendation: t("taskRecOpen", { task: open[0].title }),
          why: t("taskWhyOpen", { n: open.length }),
          steps: [...open.slice(0, 2).map((x) => x.title), t("taskTick")],
          icons: [...open.slice(0, 2).map(() => "tasks"), "tasks-done"],
          missing,
        }
      : {
          recommendation: t("taskRecNone", { crop }),
          why: t("taskWhyNone"),
          steps: [t("task1"), t("task2"), t("task3")],
          icons: ["walk", "hand", "chat"],
          missing,
        };
  }
  if (COST.test(text)) {
    const exp = activities.filter((a) => a.type === "expense");
    const total = exp.reduce((sum, a) => sum + (a.cost ?? 0), 0);
    const top = [...exp].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];
    return {
      recommendation: exp.length ? t("costRecHas", { total: total.toLocaleString(), n: exp.length }) : t("costRecNone"),
      why: exp.length ? t("costWhyHas", { top: top.note || t("unnamed") }) : t("costWhyNone"),
      steps: [t("cost1"), t("cost2"), t("cost3")],
      icons: ["pencil", "coins", "calendar"],
      missing: [...missing, ...(exp.length ? [] : [t("m_expenses")]), t("m_yield")],
    };
  }
  if (FERT.test(text)) {
    return {
      recommendation: t("fertRec", { crop }),
      why: t("fertWhy", { age }),
      steps: [t("fert1"), t("fert2"), t("fert3")],
      icons: ["shovel", "lab", "chat"],
      missing: [...missing, t("m_soilTest")],
    };
  }
  // Default: watering, the most common daily decision.
  const irr = last("irrigation");
  const Crop = crop.charAt(0).toUpperCase() + crop.slice(1);
  return {
    recommendation: irr && daysSince(irr.date) <= 1 ? t("irrRecHold", { when: ago(irr.date) }) : t("irrRecCheck", { crop }),
    why: irr ? t("irrWhyHas", { when: ago(irr.date), crop: Crop, age }) : t("irrWhyNone", { crop: Crop, age }),
    steps: [t("irr1"), t("irr2"), t("irr3")],
    icons: ["hand", "hourglass", "drip"],
    missing: [...missing, ...(irr ? [] : [t("m_irrRecords")]), t("m_soilType")],
  };
}
