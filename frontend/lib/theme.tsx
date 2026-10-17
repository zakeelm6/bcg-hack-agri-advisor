"use client";
// Theme: light / dark / auto and a high-contrast switch for direct sun. Persisted on the phone; applied as classes on <html>
// before paint by the inline script in layout.tsx (no flash). Media queries are the default; the farmer can override them.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
type Ctx = { theme: Theme; contrast: boolean; setTheme: (t: Theme) => void; setContrast: (v: boolean) => void; isDark: boolean };
const C = createContext<Ctx | null>(null);
const KEY = "fa_theme";

export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${KEY}")||"{}");var d=s.theme==="dark"||(s.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var h=s.contrast===true||(s.contrast!==false&&matchMedia("(prefers-contrast: more)").matches);var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("hc",h);}catch(e){}})();`;

function apply(theme: Theme, contrast: boolean | null) {
  const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const hc = contrast === true || (contrast === null && matchMedia("(prefers-contrast: more)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("hc", hc);
  return dark;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("auto");
  const [contrast, setContrastState] = useState<boolean | null>(null);
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "{}"); if (s.theme) setThemeState(s.theme); if (typeof s.contrast === "boolean") setContrastState(s.contrast); } catch { /* none */ }
  }, []);
  useEffect(() => {
    setIsDark(apply(theme, contrast));
    const mq = matchMedia("(prefers-color-scheme: dark)"); const on = () => setIsDark(apply(theme, contrast));
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [theme, contrast]);
  const save = (t: Theme, c: boolean | null) => { try { localStorage.setItem(KEY, JSON.stringify({ theme: t, contrast: c })); } catch { /* full */ } };
  const setTheme = useCallback((t: Theme) => { setThemeState(t); setContrastState((c) => { save(t, c); return c; }); }, []);
  const setContrast = useCallback((v: boolean) => { setContrastState(v); setThemeState((t) => { save(t, v); return t; }); }, []);
  return <C.Provider value={{ theme, contrast: !!contrast, setTheme, setContrast, isDark }}>{children}</C.Provider>;
}
export const useTheme = () => useContext(C)!;
