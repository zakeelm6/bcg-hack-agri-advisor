import type { Key } from "./i18n";
import { Icon } from "./icons";

// Photo shortcuts to common questions, shown on the Co-Pilot and on My Farm.
export const starters: { icon: string; img: string; title: Key; q: Key }[] = [
  { icon: "drip", img: "/images/tile-water.webp", title: "starterWater", q: "askIrrigate" },
  { icon: "no-pest", img: "/images/tile-sick.webp", title: "starterSick", q: "starterSickQ" },
  { icon: "coins", img: "/images/tile-harvest.webp", title: "starterCosts", q: "starterCostsQ" },
  { icon: "rake", img: "/images/tile-healthy.webp", title: "starterToday", q: "askWhatQ" },
];

export const photoCard = "overflow-hidden rounded-2xl border border-line bg-card text-start active:scale-[.98]";

// The picture says what the question is about before any reading.
export function PhotoCardBody({ s, label }: { s: (typeof starters)[number]; label: string }) {
  return (
    <>
      <img src={s.img} alt="" loading="lazy" width={600} height={450} className="aspect-[4/3] w-full object-cover" />
      <span className="flex items-center gap-2 p-3 text-lg font-medium"><Icon name={s.icon} className="h-5 w-5 shrink-0 text-leaf" />{label}</span>
    </>
  );
}
