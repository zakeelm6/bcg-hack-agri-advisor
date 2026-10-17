"use client";
// Button: one component for every action. Variants: primary (the one action of the screen), secondary, ghost, danger, icon.
// Sizes sm 44, md 52, lg 60 px. States: hover, focus-visible, active, disabled, loading. Renders a link when `href` is given.
import Link from "next/link";
import { forwardRef } from "react";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";
type Base = { variant?: Variant; size?: Size; icon?: string; iconEnd?: string; loading?: boolean; full?: boolean; iconOnly?: boolean; className?: string; children?: React.ReactNode };
type Props = Base & (({ href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) | ({ href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">));

const V: Record<Variant, string> = {
  primary: "bg-brand-strong text-on-brand hover:brightness-110 border border-transparent",
  accent: "bg-accent text-on-accent hover:bg-accent-strong border border-transparent",
  secondary: "bg-surface text-brand border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-danger-soft text-on-danger-soft border border-transparent hover:brightness-95",
};
const S: Record<Size, string> = { sm: "min-h-11 px-4 text-sm gap-1.5", md: "min-h-[52px] px-5 text-base gap-2", lg: "min-h-[60px] px-6 text-lg gap-2.5" };
const ICON_ONLY: Record<Size, string> = { sm: "h-11 w-11", md: "h-[52px] w-[52px]", lg: "h-[60px] w-[60px]" };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "secondary", size = "md", icon, iconEnd, loading, full, iconOnly, className = "", children, ...rest }, ref) {
  const cls = `pressable inline-flex items-center justify-center rounded-full font-semibold transition-[background-color,color,transform,opacity] duration-150 ease-out disabled:opacity-45 disabled:pointer-events-none select-none ${V[variant]} ${iconOnly ? ICON_ONLY[size] + " px-0" : S[size]} ${full ? "w-full" : ""} ${className}`;
  const inner = (<>
    {loading ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon && <Icon name={icon} size={size === "sm" ? 18 : 22} />}
    {children && <span className={iconOnly ? "sr-only" : ""}>{children}</span>}
    {iconEnd && !iconOnly && <Icon name={iconEnd} size={size === "sm" ? 18 : 22} className="rtl:-scale-x-100" />}
  </>);
  if ("href" in rest && rest.href) { const { href, ...link } = rest as { href: string } & Record<string, unknown>; return <Link href={href} className={cls} {...(link as object)}>{inner}</Link>; }
  const { href: _h, ...btn } = rest as { href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>; void _h;
  return <button ref={ref} type="button" aria-busy={loading || undefined} className={cls} {...btn} disabled={btn.disabled || loading}>{inner}</button>;
});
