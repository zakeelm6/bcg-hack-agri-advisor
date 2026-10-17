"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFarm, useT } from "@/lib/farm";
import { isRtl, langs } from "@/lib/i18n";
import { Icon } from "@/lib/icons";

const nav = [
  { href: "/farm", key: "navFarm", icon: "M3 11l9-7 9 7v9H3zM9 20v-6h6v6" },
  { href: "/copilot", key: "navCopilot", icon: "M4 5h16v11H8l-4 4z" },
  { href: "/activities", key: "navActivities", icon: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, profile, lang, setLang } = useFarm();
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const onboarding = path === "/";

  useEffect(() => {
    if (ready && !profile && !onboarding) router.replace("/");
  }, [ready, profile, onboarding, router]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  if (!ready || (!profile && !onboarding)) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-3xl lg:max-w-5xl">
      <header className="flex items-center justify-between px-5 pt-5 pb-2 md:px-8 md:pt-6">
        <Link href="/" className="font-serif text-xl font-semibold text-leaf">growmate</Link>
        {/* Language switch on every page: returning farmers never see the welcome screen's picker. */}
        <div role="group" aria-label={t("chooseLang")} className="order-last flex items-center gap-1 text-muted md:order-none md:ms-auto md:me-4">
          <Icon name="languages" className="h-5 w-5" />
          {langs.map((l) => (
            <button key={l.id} type="button" onClick={() => setLang(l.id)} aria-pressed={lang === l.id} lang={l.id}
              className={`rounded-lg px-2.5 py-1.5 text-sm ${lang === l.id ? "bg-leaf-soft font-semibold text-leaf" : "hover:bg-card"}`}>
              {{ ar: "عربي", ary: "دارجة", fr: "FR", en: "EN" }[l.id]}
            </button>
          ))}
        </div>
      {!onboarding && (
        // Phones: fixed bottom tab bar. Tablet/desktop (md+): inline in the header.
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 backdrop-blur md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto flex max-w-md justify-around pb-[env(safe-area-inset-bottom)] md:max-w-none md:gap-1 md:pb-0">
            {nav.map((n) => {
              const active = path === n.href;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-sm md:flex-none md:flex-row md:gap-2 md:rounded-xl md:px-3.5 md:py-2 ${active ? "font-semibold text-leaf md:bg-leaf-soft" : "text-muted md:hover:bg-card"}`}>
                  <svg viewBox="0 0 24 24" className="h-7 w-7 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                    <path d={n.icon} />
                  </svg>
                  {t(n.key)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      </header>
      <main className={`flex-1 px-5 md:px-8 ${onboarding ? "pb-8" : "pb-40 md:pb-32"}`}>{children}</main>
      {!onboarding && path !== "/copilot" && (
        <Link href="/copilot" className="btn fixed end-4 bottom-[92px] z-10 flex items-center gap-2 rounded-full shadow-lg md:end-8 md:bottom-8">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
            <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3" />
          </svg>
          {t("askCopilot")}
        </Link>
      )}
    </div>
  );
}
