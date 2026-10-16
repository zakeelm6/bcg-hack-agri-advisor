"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFarm } from "@/lib/farm";

const nav = [
  { href: "/copilot", label: "Co-Pilot", icon: "M4 5h16v11H8l-4 4z" },
  { href: "/farm", label: "My Farm", icon: "M3 11l9-7 9 7v9H3zM9 20v-6h6v6" },
  { href: "/activities", label: "Activities", icon: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useFarm();
  const path = usePathname();
  const router = useRouter();
  const onboarding = path === "/";

  useEffect(() => {
    if (ready && !profile && !onboarding) router.replace("/");
  }, [ready, profile, onboarding, router]);

  if (!ready || (!profile && !onboarding)) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-3xl lg:max-w-5xl">
      <header className="flex items-center justify-between px-5 pt-5 pb-2 md:px-8 md:pt-6">
        <span className="font-serif text-xl font-semibold text-leaf">growmate</span>
      {!onboarding && (
        // Phones: fixed bottom tab bar. Tablet/desktop (md+): inline in the header.
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 backdrop-blur md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto flex max-w-md justify-around pb-[env(safe-area-inset-bottom)] md:max-w-none md:gap-1 md:pb-0">
            {nav.map((n) => {
              const active = path === n.href;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs md:flex-none md:flex-row md:gap-2 md:rounded-xl md:px-3.5 md:py-2 md:text-sm ${active ? "font-semibold text-leaf md:bg-leaf-soft" : "text-muted md:hover:bg-card"}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                    <path d={n.icon} />
                  </svg>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      </header>
      <main className={`flex-1 px-5 md:px-8 ${onboarding ? "pb-8" : "pb-28 md:pb-32"}`}>{children}</main>
    </div>
  );
}
