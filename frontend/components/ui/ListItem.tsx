// ListItem: leading circle (icon), title, supporting line, optional meta, trailing element or chevron. Link or static.
import Link from "next/link";
import { Icon } from "./Icon";

type Props = { icon?: string; iconTone?: "neutral" | "accent" | "brand" | "danger"; title: React.ReactNode; sub?: React.ReactNode; meta?: React.ReactNode; end?: React.ReactNode; href?: string; chevron?: boolean; muted?: boolean; className?: string; onClick?: () => void };
const IT = { neutral: "bg-surface-2 text-brand", accent: "bg-accent text-on-accent", brand: "bg-brand-strong text-on-brand", danger: "bg-danger-soft text-danger" };

export function ListItem({ icon, iconTone = "neutral", title, sub, meta, end, href, chevron, muted, className = "", onClick }: Props) {
  const body = (<>
    {icon && <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${IT[iconTone]} ${muted ? "opacity-60" : ""}`}><Icon name={icon} size={24} /></span>}
    <span className="min-w-0 flex-1">
      <span className={`block text-lg font-semibold leading-tight ${muted ? "text-text-2" : ""}`}>{title}</span>
      {sub && <span className="mt-0.5 block text-sm text-text-2">{sub}</span>}
      {meta && <span className="mt-1.5 block">{meta}</span>}
    </span>
    {end}
    {chevron && <Icon name="chev" size={22} className="flex-none text-text-3 rtl:-scale-x-100" />}
  </>);
  const cls = `flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start ${href || onClick ? "pressable transition-shadow duration-150 hover:shadow-2" : ""} ${className}`;
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
