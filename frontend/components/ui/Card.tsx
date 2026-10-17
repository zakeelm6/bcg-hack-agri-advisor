// Card: a surface with a hairline. `tone` tints it; `interactive` adds hover and pressed feedback (use with Link or button).
import Link from "next/link";

type Props = { tone?: "default" | "inset" | "accent" | "brand"; interactive?: boolean; href?: string; className?: string; children: React.ReactNode; as?: "div" | "section" | "article" };
const T = { default: "bg-surface border-line", inset: "bg-surface-2 border-transparent", accent: "bg-accent text-on-accent border-transparent", brand: "bg-brand-strong text-on-brand border-transparent" };

export function Card({ tone = "default", interactive, href, className = "", children, as: Tag = "div" }: Props) {
  const cls = `block rounded-xl border p-4 ${T[tone]} ${interactive ? "pressable transition-[box-shadow,transform] duration-150 hover:shadow-2" : ""} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <Tag className={cls}>{children}</Tag>;
}

/** Section title inside a card or a page: small caps label with an optional trailing element. */
export function Label({ children, end, className = "", inherit }: { children: React.ReactNode; end?: React.ReactNode; className?: string; inherit?: boolean }) {
  return <div className={`flex items-center justify-between gap-2 ${className}`}><span className={`text-xs font-bold uppercase tracking-[.08em] ${inherit ? "text-current" : "text-text-3"}`}>{children}</span>{end}</div>;
}
