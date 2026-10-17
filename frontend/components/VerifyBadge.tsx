"use client";
// The independent check of a task's quantity (Phase 4): verified, fixed (capped) or escalated (no dose, see your advisor).
import { useT } from "@/lib/farm";
import { Badge } from "./ui";

export function VerifyBadge({ status, size = "sm" }: { status?: string | null; size?: "sm" | "md" }) {
  const t = useT();
  if (!status) return null;
  if (status === "escalated") return <Badge tone="warning" icon="warning" size={size}>{t("escalated")}</Badge>;
  if (status === "fixed") return <Badge tone="info" icon="shield" size={size}>{t("fixed")}</Badge>;
  return <Badge tone="success" icon="shield" size={size}>{t("verified")}</Badge>;
}
