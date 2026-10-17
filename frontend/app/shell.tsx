"use client";
// Shell: brand, language switch, five-tab navigation (bottom bar on phones, inline on wide screens), offline banner.
// Semantic colours live in globals.css; logical properties keep Arabic right-to-left correct.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Banner } from "@/components/Banner";
import { Ic } from "@/components/ui";
import { useAppState, unreadCount } from "@/lib/data";
import { useFarm, useT } from "@/lib/farm";
import { isRtl, langs } from "@/lib/i18n";

const NAV = [
  { href: "/home", key: "navHome", icon: "home" }, { href: "/field", key: "navField", icon: "leaf" }, { href: "/tasks", key: "navTasks", icon: "tasks" },
  { href: "/sell", key: "navSell", icon: "sell" }, { href: "/alerts", key: "navAlerts", icon: "bell" }, { href: "/me", key: "navMe", icon: "user" },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, profile, lang, setLang } = useFarm();
  const t = useT();
  const path = usePathname() ?? "/";
  const router = useRouter();
  const onboarding = path === "/";
  const { data: s } = useAppState();

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr"; }, [lang]);
  useEffect(() => { if (ready && profile && onboarding) router.replace("/home"); }, [ready, profile, onboarding, router]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  if (!ready) return null;
  const unread = unreadCount(s);
  const active = (href: string) => path === href || (href !== "/home" && path.startsWith(href + "/")) || (href === "/tasks" && path.startsWith("/tasks"));

  return (
    <div className="flex min-h-dvh w-full flex-col bg-surface">
      <header className="flex min-h-16 items-center gap-2 rounded-b-3xl bg-leaf px-3 py-1.5 text-paper md:gap-3 md:px-4">
        <Link href={onboarding ? "/" : "/home"} className="inline-flex min-h-12 items-center gap-2.5 whitespace-nowrap pe-2 text-base font-bold md:text-lg"><Ic name="leaf" size={26} /><span>{t("appName")}</span></Link>
        {!onboarding && (
          <nav aria-label="Main" className="ms-auto hidden gap-2 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`relative rounded-full px-4 py-2.5 font-semibold ${active(n.href) ? "bg-paper text-leaf" : "opacity-85 hover:bg-white/10"}`}>
                {t(n.key)}{n.key === "navAlerts" && unread > 0 && <i className="absolute top-1.5 end-2.5 h-2.5 w-2.5 rounded-full bg-sun" />}
              </Link>
            ))}
          </nav>
        )}
        <span className={`inline-flex items-center gap-2 ${onboarding ? "ms-auto" : "ms-auto md:ms-0"}`}>
          <span role="group" aria-label={t("chooseLang")} className="inline-flex overflow-hidden rounded-full border-[1.5px] border-current text-[11px] font-bold md:text-xs">
            {langs.map((l) => <button key={l.id} type="button" lang={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} title={l.name} className={`min-h-12 min-w-[46px] px-1.5 md:min-w-12 md:px-3 ${lang === l.id ? "bg-paper text-leaf" : "opacity-80"}`}>{{ ar: "عربي", ary: "دارجة", fr: "FR", en: "EN" }[l.id]}</button>)}
          </span>
          {!onboarding && <Link href="/me#about" aria-label={t("about")} className="grid h-12 w-12 place-items-center rounded-full hover:bg-white/15"><Ic name="info" size={22} /></Link>}
        </span>
      </header>
      <main className={`m-3 flex-1 rounded-3xl bg-page p-3 md:m-4 md:mx-[clamp(16px,2.5vw,48px)] md:p-7 ${onboarding ? "" : "pb-28 md:pb-8"}`}>
        {!onboarding && <Banner />}
        {children}
      </main>
      {!onboarding && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid h-[78px] grid-cols-6 rounded-t-3xl bg-leaf text-paper md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active(n.href) ? "font-bold opacity-100" : "opacity-80"}`}>
              <Ic name={n.icon} size={26} /><span>{t(n.key)}</span>
              {active(n.href) && <i className="absolute bottom-1.5 h-1 w-5 rounded-full bg-sun" />}
              {n.key === "navAlerts" && unread > 0 && <i className="absolute top-3 end-[calc(50%-20px)] h-2.5 w-2.5 rounded-full bg-sun" />}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
