"use client";
// Compatibility re-exports for screens not yet moved to components/ui/*. Remove when every screen uses the library.
import { ConfidenceMeter, Badge, Icon, ICONS as I2, taskIcon as ti, Skeleton as Sk } from "./ui/index";
export { ToastProvider, useToast } from "./ui/Toast";
export const ICONS = I2; export const taskIcon = ti;
export const Ic = ({ name, size = 24, className }: { name: string; size?: number; w?: number; className?: string }) => <Icon name={name} size={size} className={className} />;
export const Meter = ({ conf, small }: { conf: string; small?: boolean; light?: boolean }) => <ConfidenceMeter conf={conf} size={small ? "sm" : "md"} />;
export const Tag = ({ warn, children }: { warn?: boolean; children: React.ReactNode }) => <Badge tone={warn ? "simulated" : "neutral"} className="me-1.5 mt-1">{children}</Badge>;
export const Circle = ({ tone = "soft", size = 52, children }: { tone?: "soft" | "amber" | "green"; size?: number; children: React.ReactNode }) => (
  <span className={`grid flex-none place-items-center rounded-full ${tone === "amber" ? "bg-accent text-on-accent" : tone === "green" ? "bg-brand-strong text-on-brand" : "bg-surface-2 text-brand"}`} style={{ width: size, height: size }}>{children}</span>
);
export const Skeleton = ({ className = "" }: { className?: string }) => <Sk className={className} />;
