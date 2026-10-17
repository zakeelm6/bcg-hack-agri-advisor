"use client";
// Shell: brand, language control, six-tab navigation (bottom bar on phones with safe-area inset, inline on wide screens),
// offline status. Content is centred at 1200 px so a wide screen is a considered layout, not a stretched phone.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Banner } from "@/components/Banner";
import { LangControl } from "@/components/LangControl";
import { Icon } from "@/components/ui";
import { useAppState, unreadCount } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { isRtl } from "@/lib/i18n";

const NAV = [
  { href: "/home", key: "navHome", icon: "home" }, { href: "/field", key: "navField", icon: "leaf" }, { href: "/tasks", key: "navTasks", icon: "tasks" },
  { href: "/sell", key: "navSell", icon: "sell" }, { href: "/alerts", key: "navAlerts", icon: "bell" }, { href: "/me", key: "navMe", icon: "user" },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, profile, lang } = useFarm();
  const t = useT();
  const path = usePathname() ?? "/";
  const router = useRouter();
  const onboarding = path === "/";
  const design = path === "/design";
  const { data: s } = useAppState();

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr"; }, [lang]);
  useEffect(() => { if (ready && profile && onboarding) router.replace("/home"); }, [ready, profile, onboarding, router]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  if (!ready) return null;
  const unread = unreadCount(s);
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="flex min-h-dvh w-full flex-col bg-bg">
      <header className="sticky top-0 z-30 bg-brand-strong text-on-brand shadow-1">
        <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center gap-2 px-3 py-2 md:gap-3 md:px-6">
          <Link href={onboarding ? "/" : "/home"} className="inline-flex min-h-12 items-center gap-2.5 whitespace-nowrap pe-2 font-display text-lg md:text-xl">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/12"><Icon name="leaf" size={22} /></span><span>{t("appName")}</span>
          </Link>
          {!onboarding && (
            <nav aria-label="Main" className="ms-auto hidden gap-1 md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`relative inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${active(n.href) ? "bg-surface text-brand" : "opacity-90 hover:bg-white/10"}`}>
                  {t(n.key)}{n.key === "navAlerts" && unread > 0 && <i aria-hidden className="absolute top-1.5 end-2 h-2 w-2 rounded-full bg-accent" />}
                </Link>
              ))}
            </nav>
          )}
          <span className={`inline-flex items-center gap-2 ${onboarding ? "ms-auto" : "ms-auto md:ms-0"}`}><LangControl onDark /></span>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-[1200px] flex-1 px-3 pt-3 md:px-6 md:pt-5 ${onboarding || design ? "pb-8" : "pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10"}`}>
        {!onboarding && <Banner />}
        {children}
      </main>
      {!onboarding && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid h-[72px] grid-cols-6">
            {NAV.map((n) => {
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${on ? "text-brand" : "text-text-3"}`}>
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors ${on ? "bg-brand-soft" : ""}`}><Icon name={n.icon} size={24} /></span>
                  <span>{t(n.key)}</span>
                  {n.key === "navAlerts" && unread > 0 && <i aria-hidden className="absolute top-2 end-[calc(50%-14px)] h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
