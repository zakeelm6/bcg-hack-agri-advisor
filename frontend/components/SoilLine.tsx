"use client";
import type { StateOut } from "@/lib/api";
import { useT } from "@/lib/farm";

export type Test = StateOut["soil_tests"][number] & { pending?: boolean; ph?: number | null; om_pct?: number | null; moisture?: number | null; age_days?: number };

export function SoilLine({ test }: { test: Test }) {
  const t = useT();
  const parts = [test.ph != null ? `pH ${test.ph}` : "", test.om_pct != null ? `${t("organic")} ${test.om_pct}%` : "", test.moisture != null ? `${t("moisture")} ${Math.round(test.moisture * 100)}%` : ""].filter(Boolean).join(", ");
  const age = test.age_days === 0 ? t("ago_0") : test.age_days === 1 ? t("ago_1") : t("agoN", { n: test.age_days ?? 0 });
  return <>{t("zoneLine", { z: test.zone_code, line: parts, age })}{test.pending ? ` - ${t("waitingSync")}` : ""}</>;
}

