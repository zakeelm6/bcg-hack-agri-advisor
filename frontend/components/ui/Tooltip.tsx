"use client";
// Tooltip: a short explanation on hover or focus; on touch it is the same text shown on tap (toggle). Keep it to one sentence.
import { useId, useState } from "react";

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false); const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span aria-describedby={id} onClick={() => setOpen((v) => !v)}>{children}</span>
      <span id={id} role="tooltip" className={`pointer-events-none absolute bottom-full start-1/2 z-20 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-2 text-xs text-on-inverse shadow-2 transition-opacity duration-150 rtl:translate-x-1/2 dark:bg-neutral-100 ${open ? "opacity-100" : "opacity-0"}`}>{text}</span>
    </span>
  );
}
