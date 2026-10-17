"use client";
// Language: one 48 px button showing the current language in its own script; a sheet lists the four languages. Fits any header.
import { useState } from "react";
import { useFarm, useT } from "@/lib/farm";
import { langs, type Lang } from "@/lib/i18n";
import { Button, Icon, Sheet } from "./ui";

const SHORT: Record<Lang, string> = { en: "EN", fr: "FR", ar: "عربي", ary: "دارجة" };
export const LANG_NATIVE: Record<Lang, string> = { en: "English", fr: "Français", ar: "العربية", ary: "الدارجة" };

export function LangControl({ onDark }: { onDark?: boolean }) {
  const t = useT();
  const { lang, setLang } = useFarm();
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${t("chooseLang")}: ${SHORT[lang]}`} lang={lang}
      className={`pressable inline-flex min-h-12 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${onDark ? "border-on-brand/40 text-on-brand hover:bg-white/10" : "border-line-strong bg-surface text-text hover:bg-surface-2"}`}>
      <Icon name="globe" size={18} /><span>{SHORT[lang]}</span><Icon name="chevdown" size={14} />
    </button>
    <Sheet open={open} onClose={() => setOpen(false)} title={t("chooseLang")} closeLabel={t("close")}>
      <ul className="mb-2 space-y-2">
        {langs.map((l) => {
          const on = l.id === lang;
          return (
            <li key={l.id}>
              <button type="button" lang={l.id} dir={l.id === "ar" || l.id === "ary" ? "rtl" : "ltr"} aria-pressed={on} onClick={() => { setLang(l.id); setOpen(false); }}
                className={`pressable flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 text-start text-lg font-semibold ${on ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>
                <span>{LANG_NATIVE[l.id]}</span>{on && <Icon name="check" size={22} />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-text-3">{t("darijaNote")}</p>
      <div className="h-2" />
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} full>{t("close")}</Button>
    </Sheet>
  </>);
}
