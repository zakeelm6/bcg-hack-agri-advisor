"use client";
// Shell: brand, language control, six-tab navigation (bottom bar on phones with safe-area inset, inline on wide screens),
// offline status. Content is centred at 1200 px so a wide screen is a considered layout, not a stretched phone.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { LangControl } from "@/components/LangControl";
import { Button, Icon, Sheet } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";
import { useAppState, unreadCount } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { isRtl } from "@/lib/i18n";

const NAV_FULL = [
  { href: "/home", key: "navHome", icon: "home" }, { href: "/field", key: "navField", icon: "leaf" }, { href: "/tasks", key: "navTasks", icon: "tasks" },
  { href: "/sell", key: "navSell", icon: "sell" }, { href: "/alerts", key: "navAlerts", icon: "bell" }, { href: "/me", key: "navMe", icon: "user" },
] as const;
// simple mode: two places and a "More" sheet; pictures first, few words
const NAV_SIMPLE = [{ href: "/today", key: "navToday", icon: "sun" }, { href: "/field", key: "navMyField", icon: "leaf" }] as const;
const MORE = [{ href: "/tasks", key: "navTasks", icon: "tasks" }, { href: "/alerts", key: "navAlerts", icon: "bell" }, { href: "/sell", key: "navSell", icon: "sell" }, { href: "/me", key: "navMe", icon: "user" }, { href: "/setup", key: "setup", icon: "contrast" }] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, profile, lang, mode } = useFarm();
  const [more, setMore] = useState(false);
  const t = useT();
  const path = usePathname() ?? "/";
  const router = useRouter();
  const landing = path === "/";
  const onboarding = landing || path === "/start";   // public pages: no app navigation, no banner
  const design = path === "/design";
  const { data: s } = useAppState();

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr"; }, [lang]);
  useEffect(() => { if (ready && profile && path === "/start" && !location.search.includes("edit")) router.replace(mode === "simple" ? "/today" : "/home"); }, [ready, profile, path, router, mode]);
  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  if (!ready) return null;
  const unread = unreadCount(s);
  const simple = mode === "simple";
  const NAV = simple ? NAV_SIMPLE : NAV_FULL;
  const homeHref = simple ? "/today" : "/home";
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="flex min-h-dvh w-full flex-col bg-bg">
      <header className="sticky top-0 z-30 bg-brand-strong text-on-brand shadow-1">
        <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center gap-2 px-3 py-2 md:gap-3 md:px-6">
          <Link href={onboarding ? "/" : homeHref} className="inline-flex min-h-12 items-center gap-2.5 whitespace-nowrap pe-2 font-display text-lg md:text-xl">
            <Logo size={36} /><span>{t("appName")}</span>
          </Link>
          {!onboarding && (
            <nav aria-label="Main" className="ms-auto hidden gap-1 md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`relative inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${active(n.href) ? "bg-surface text-brand" : "opacity-90 hover:bg-white/10"}`}>
                  {t(n.key)}{n.key === "navAlerts" && unread > 0 && <i aria-hidden className="absolute top-1.5 end-2 h-2 w-2 rounded-full bg-accent" />}
                </Link>
              ))}
              {simple && <button type="button" onClick={() => setMore(true)} className="relative inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold opacity-90 hover:bg-white/10">{t("navMore")}<Icon name="chevdown" size={14} />{unread > 0 && <i aria-hidden className="absolute top-1.5 end-2 h-2 w-2 rounded-full bg-accent" />}</button>}
            </nav>
          )}
          <span className={`inline-flex items-center gap-2 ${onboarding ? "ms-auto" : "ms-auto md:ms-0"}`}>
            {landing && <Link href="/#about" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold opacity-90 hover:bg-white/10 sm:inline-flex">{t("aboutTitle")}</Link>}
            <LangControl onDark />
            {landing && <Link href={profile ? homeHref : "/start"} className="pressable hidden min-h-12 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold text-on-accent sm:inline-flex">{t("goIn")}<Icon name="chev" size={16} className="rtl:-scale-x-100" /></Link>}
          </span>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-[1200px] flex-1 px-3 pt-3 md:px-6 md:pt-5 ${onboarding || design ? "pb-8" : "pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10"}`}>
        {!onboarding && <Banner />}
        {children}
      </main>
      {!onboarding && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className={`grid ${simple ? "h-[80px] grid-cols-3" : "h-[72px] grid-cols-6"}`}>
            {NAV.map((n) => {
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 font-semibold transition-colors ${simple ? "text-sm" : "text-[11px]"} ${on ? "text-brand" : "text-text-3"}`}>
                  <span className={`grid place-items-center rounded-full transition-colors ${simple ? "h-10 w-16" : "h-8 w-12"} ${on ? "bg-brand-soft" : ""}`}><Icon name={n.icon} size={simple ? 28 : 24} /></span>
                  <span>{t(n.key)}</span>
                  {n.key === "navAlerts" && unread > 0 && <i aria-hidden className="absolute top-2 end-[calc(50%-14px)] h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />}
                </Link>
              );
            })}
            {simple && (
              <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className="relative flex flex-col items-center justify-center gap-0.5 text-sm font-semibold text-text-3">
                <span className="grid h-10 w-16 place-items-center rounded-full"><Icon name="plus" size={28} /></span><span>{t("navMore")}</span>
                {unread > 0 && <i aria-hidden className="absolute top-2 end-[calc(50%-14px)] h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />}
              </button>
            )}
          </div>
        </nav>
      )}
      <Sheet open={more} onClose={() => setMore(false)} title={t("navMore")} closeLabel={t("close")}>
        <div className="grid grid-cols-2 gap-2 pb-2">
          {MORE.map((n) => <Link key={n.href} href={n.href} className="pressable relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface text-base font-semibold hover:bg-surface-2"><Icon name={n.icon} size={28} className="text-brand" />{t(n.key)}{n.key === "navAlerts" && unread > 0 && <i aria-hidden className="absolute top-2 end-2 h-2.5 w-2.5 rounded-full bg-accent" />}</Link>)}
        </div>
        <Button variant="ghost" full onClick={() => setMore(false)}>{t("close")}</Button>
      </Sheet>
    </div>
  );
}
