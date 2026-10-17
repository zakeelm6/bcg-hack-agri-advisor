import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Noto_Naskh_Arabic } from "next/font/google";
import { CopilotProvider } from "@/components/Copilot";
import { ToastProvider } from "@/components/ui";
import { DataProvider } from "@/lib/data";
import { FarmProvider } from "@/lib/farm";
import { THEME_SCRIPT, ThemeProvider } from "@/lib/theme";
import Shell from "./shell";
import "./globals.css";

// Self-hosted by next/font (font-display: swap). Geist for the interface, Fraunces for titles, Noto Naskh for Arabic and Darija.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600"] });
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Farm Advisor - AI advice from your field data",
  description: "Farm Advisor reads your land (satellite vigor, weather, soil sensors, soil tests) and tells you what to do, when and why, then follows up. Works offline.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#254B22" }, { media: "(prefers-color-scheme: dark)", color: "#11150E" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${fraunces.variable} ${naskh.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="font-sans antialiased">
        <ThemeProvider>
        <FarmProvider>
          <DataProvider>
            <ToastProvider>
              <CopilotProvider>
                <Shell>{children}</Shell>
              </CopilotProvider>
            </ToastProvider>
          </DataProvider>
        </FarmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
