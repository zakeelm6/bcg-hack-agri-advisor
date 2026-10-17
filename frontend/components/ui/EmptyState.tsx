// EmptyState: says what is here (nothing) and what to do next. One consistent illustration style: a circle with an icon.
import { Icon } from "./Icon";

export function EmptyState({ icon = "check", title, children, action, tone = "neutral" }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode; tone?: "neutral" | "success" }) {
  return (
    <div className="anim-fade-in flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <span className={`grid h-16 w-16 place-items-center rounded-full ${tone === "success" ? "bg-success-soft text-success" : "bg-surface-2 text-text-3"}`}><Icon name={icon} size={30} /></span>
      <h3 className="font-display text-xl">{title}</h3>
      {children && <p className="max-w-sm text-sm text-text-2">{children}</p>}
      {action}
    </div>
  );
}
