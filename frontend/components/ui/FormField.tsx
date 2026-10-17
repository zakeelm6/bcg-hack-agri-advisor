"use client";
// FormField: label, optional hint, input with a unit suffix, error text linked by aria-describedby.
import { useId } from "react";

type Props = { label: string; hint?: string; unit?: string; error?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;
export function FormField({ label, hint, unit, error, className = "", ...input }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 px-1"><span className="text-sm font-semibold">{label}</span>{hint && <span className="text-xs text-text-3">{hint}</span>}</span>
      <span className={`flex items-center overflow-hidden rounded-lg border-2 bg-surface transition-colors focus-within:border-brand ${error ? "border-danger" : "border-line"}`}>
        <input id={id} aria-invalid={!!error || undefined} aria-describedby={error ? id + "-err" : undefined} className="num min-h-[52px] min-w-0 flex-1 bg-transparent px-4 text-base text-text outline-none placeholder:text-text-3/70" {...input} />
        {unit && <span className="pe-4 text-sm font-semibold text-text-3">{unit}</span>}
      </span>
      {error && <span id={id + "-err"} role="alert" className="mt-1 block px-1 text-sm text-danger">{error}</span>}
    </label>
  );
}
