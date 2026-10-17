"use client";
// Segmented control: one choice among a few (layers, filters, days). Keyboard: arrows move, Enter/Space select. 48 px targets.
import { Icon } from "./Icon";

export type Segment<T extends string> = { id: T; label: string; icon?: string; dot?: boolean };
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className = "", wrap, grow }: { value: T; onChange: (v: T) => void; options: Segment<T>[]; label: string; size?: "sm" | "md"; className?: string; wrap?: boolean; grow?: boolean }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return; e.preventDefault(); const n = options[(i + d + options.length) % options.length]; onChange(n.id);
    (e.currentTarget.parentElement?.children[(i + d + options.length) % options.length] as HTMLElement)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`${grow ? "flex w-full" : "inline-flex max-w-full"} gap-1 rounded-full bg-surface-2 p-1 ${wrap ? "flex-wrap" : grow ? "" : "overflow-x-auto no-scrollbar"} ${className}`}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(o.id)}
            className={`pressable relative inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-150 ${grow ? "min-w-0 flex-1 px-1.5 leading-tight" : "whitespace-nowrap"} ${size === "sm" ? "min-h-11 text-sm" : "min-h-12 text-sm"} ${!grow ? (size === "sm" ? "px-3" : "px-4") : ""} ${on ? "bg-surface text-brand shadow-1" : "text-text-2 hover:text-text"}`}>
            {o.icon && <Icon name={o.icon} size={18} className={grow ? "max-[420px]:hidden" : ""} />}<span className={grow ? "truncate" : ""}>{o.label}</span>
            {o.dot && <i aria-hidden className="absolute top-1.5 end-2 h-2 w-2 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
