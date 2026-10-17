// Banner: an inline message that stays. Tones: info (neutral, calm), warning, danger, success. Never the accent colour:
// a banner is information, not the action of the screen.
import { Icon } from "./Icon";

const T = { info: "bg-surface-2 text-text border-line", warning: "bg-warning-soft text-on-warning-soft border-transparent", danger: "bg-danger-soft text-on-danger-soft border-transparent", success: "bg-success-soft text-on-success-soft border-transparent" };
const I = { info: "info", warning: "warning", danger: "warning", success: "check" };
export function Banner({ tone = "info", icon, title, children, action, className = "" }: { tone?: keyof typeof T; icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${T[tone]} ${className}`}>
      <Icon name={icon ?? I[tone]} size={22} className="mt-0.5" />
      <div className="min-w-0 flex-1"><b className="block text-sm font-bold">{title}</b>{children && <div className="text-sm opacity-90">{children}</div>}</div>
      {action}
    </div>
  );
}
