import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import { CopilotProvider } from "@/components/Copilot";
import { ToastProvider } from "@/components/ui";
import { DataProvider } from "@/lib/data";
import { FarmProvider } from "@/lib/farm";
import Shell from "./shell";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "Farm Advisor - AI advice from your field data",
  description: "Farm Advisor reads your land (satellite vigor, weather, soil sensors, soil tests) and tells you what to do, when and why, then follows up. Works offline.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2F5429" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${arabic.variable} font-sans antialiased`}>
        <FarmProvider>
          <DataProvider>
            <ToastProvider>
              <CopilotProvider>
                <Shell>{children}</Shell>
              </CopilotProvider>
            </ToastProvider>
          </DataProvider>
        </FarmProvider>
      </body>
    </html>
  );
}
