// Badge: short status words. `tone` carries the meaning; an icon or the text always accompanies the colour.
import { Icon } from "./Icon";

type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info" | "simulated" | "outline";
const T: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-2", brand: "bg-brand-soft text-brand", accent: "bg-accent-soft text-on-warning-soft", success: "bg-success-soft text-on-success-soft",
  warning: "bg-warning-soft text-on-warning-soft", danger: "bg-danger-soft text-on-danger-soft", info: "bg-info-soft text-on-info-soft",
  simulated: "bg-surface-2 text-text-2 border border-dashed border-line-strong", outline: "bg-transparent text-text-2 border border-line-strong",
};
export function Badge({ tone = "neutral", icon, children, className = "", size = "sm" }: { tone?: Tone; icon?: string; children: React.ReactNode; className?: string; size?: "sm" | "md" }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ${size === "sm" ? "min-h-6 px-2 text-xs" : "min-h-8 px-3 text-sm"} ${T[tone]} ${className}`}>{icon && <Icon name={icon} size={size === "sm" ? 13 : 16} />}{children}</span>;
}
