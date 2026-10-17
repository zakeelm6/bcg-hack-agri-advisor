"use client";
// Sheet: a bottom sheet on phones, a centred dialog on wide screens. Native <dialog> gives the focus trap, Escape and the
// backdrop; we add the slide-up, the handle, a labelled title and a close button. Content scrolls inside.
import { useEffect, useRef } from "react";
import { Button } from "./Button";

export function Sheet({ open, onClose, title, children, closeLabel, size = "md" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; closeLabel: string; size?: "md" | "lg" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="sheet-title"
      className={`m-0 w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-neutral-900/50 backdrop:backdrop-blur-[2px] open:flex open:flex-col justify-end md:m-auto md:h-auto md:justify-center ${size === "lg" ? "md:max-w-2xl" : "md:max-w-md"} max-h-dvh h-dvh md:max-h-[85vh]`}>
      <div className="anim-[sheet-up_250ms_var(--ease-out)] flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface text-text shadow-3 md:max-h-[85vh] md:rounded-2xl" style={{ animation: "sheet-up var(--duration-slow) var(--ease-out)" }}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line-strong md:hidden" aria-hidden />
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <h2 id="sheet-title" className="font-display text-xl">{title}</h2>
          <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>{closeLabel}</Button>
        </header>
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>
  );
}
