import type { Metadata, Viewport } from "next";
import { Geist, Fraunces } from "next/font/google";
import { FarmProvider } from "@/lib/farm";
import Shell from "./shell";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = { title: "growmate", description: "Your AI farming co-pilot" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f4ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${fraunces.variable} font-sans antialiased`}>
        <FarmProvider>
          <Shell>{children}</Shell>
        </FarmProvider>
      </body>
    </html>
  );
}
