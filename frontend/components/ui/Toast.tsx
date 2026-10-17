"use client";
// Toast: a quiet confirmation with an optional action (Undo). One at a time; a plain note never replaces an action toast.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; text: string; icon?: string; action?: { label: string; fn: () => void } };
const Ctx = createContext<(text: string, action?: Toast["action"], icon?: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<Toast | null>(null);
  const push = useCallback((text: string, action?: Toast["action"], icon?: string) => setT((cur) => (cur?.action && !action ? cur : { id: Date.now(), text, action, icon })), []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), t.action ? 6000 : 3200); return () => clearTimeout(h); }, [t]);
  return (
    <Ctx.Provider value={push}>
      {children}
      {t && (
        <div key={t.id} role="status" className="anim-fade-up fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[80] mx-auto flex max-w-[420px] items-center gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-on-inverse shadow-3 dark:bg-neutral-100 md:bottom-8">
          {t.icon && <Icon name={t.icon} size={20} className="text-accent" />}
          <span className="flex-1">{t.text}</span>
          {t.action && <button type="button" onClick={() => { setT(null); t.action!.fn(); }} className="pressable min-h-11 flex-none rounded-full bg-accent px-4 font-bold text-on-accent">{t.action.label}</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}
