// Plain words for a task, for farmers who read little: no numbers, no units. The engine's exact figures stay one tap away.
import type { TaskOut } from "./api";
import type { Key } from "./i18n";

export function plainTitle(t: (k: Key, v?: Record<string, string | number>) => string, task: TaskOut, zones?: string[], total = 4) {
  const all = !!zones && zones.length >= total, many = !!zones && zones.length > 1, z = many ? zones.join(", ") : task.zone_code;
  if (task.type === "irrigate") return t(all ? "plainWaterAll" : many ? "plainWaterMany" : "plainWater", { z });
  if (task.type === "fertilize") return t(all ? "plainFeedAll" : many ? "plainFeedMany" : "plainFeed", { z });
  if (task.type === "inspect") return t(all ? "plainWalkAll" : many ? "plainWalkMany" : "plainWalk", { z });
  if (task.type === "harvest") return t("plainHarvest");
  return t("plainTask", { z });
}

/** Same action, same moment, same verdict in several zones -> one card. Returns groups in the engine's order. */
export function groupTasks(tasks: TaskOut[]): { task: TaskOut; tasks: TaskOut[]; zones: string[] }[] {
  const out: { key: string; task: TaskOut; tasks: TaskOut[]; zones: string[] }[] = [];
  for (const task of tasks) {
    const key = `${task.type}|${task.when_text}|${task.verify_status ?? ""}`;
    const g = out.find((x) => x.key === key);
    if (g) { g.tasks.push(task); g.zones.push(task.zone_code); } else out.push({ key, task, tasks: [task], zones: [task.zone_code] });
  }
  return out;
}
/** The spoken detail: the engine's own sentences (why, then what it costs in pump time / sacks), never recomputed here. */
export const plainDetail = (task: TaskOut) => `${task.why} ${task.cost}`;
