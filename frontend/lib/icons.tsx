import {
  Apple, Bean, Bug, Building2, Camera, Check, Citrus, CircleHelp, CircleStop, ClipboardCheck, ClipboardList, Cloud,
  CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Coins, Droplet, Droplets, Footprints, Hand, Hourglass,
  Keyboard, Languages, LeafyGreen, MapPin, MessageCircle, Mic, Minus, Pencil, Plus, Ruler, Search, Shovel, ShoppingBasket,
  ShowerHead, Shrub, SprayCan, Sprout, Sun, TreeDeciduous, TriangleAlert, Volume2, Waves, Wheat, type LucideIcon,
} from "lucide-react";
import { farmIcons } from "./farm-icons";

// Farming concepts use the team's icon set (farm-icons.ts); lucide fills the gaps (weather, UI controls).
// One line-icon set for the whole app. Names are plain strings so the backend can send them in Advice.icons.
// ponytail: no tomato/onion/maize/melon icon exists in lucide; closest shapes are used and the label carries the meaning.
const icons = {
  tomato: Apple, wheat: Wheat, olive: TreeDeciduous, potato: Bean, onion: LeafyGreen, citrus: Citrus, maize: Sprout, melon: Shrub,
  sprout: Sprout, seedling: LeafyGreen, shrub: Shrub, tree: TreeDeciduous, unknown: CircleHelp,
  drip: Droplet, sprinkler: ShowerHead, flood: Waves, rain: CloudRain,
  water: Droplets, bug: Bug, coins: Coins, basket: ShoppingBasket, spray: SprayCan, shovel: Shovel,
  sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, fog: CloudFog, snow: CloudSnow, storm: CloudLightning,
  search: Search, hand: Hand, hourglass: Hourglass, walk: Footprints, chat: MessageCircle, pencil: Pencil,
  calendar: ClipboardCheck, lab: Building2, tasks: ClipboardList, check: Check, "tasks-done": ClipboardCheck,
  pin: MapPin, ruler: Ruler, alert: TriangleAlert, speaker: Volume2, stop: CircleStop, keyboard: Keyboard,
  camera: Camera, mic: Mic, languages: Languages, minus: Minus, plus: Plus,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const paths = farmIcons[name];
  if (paths) return (
    // The sheet was drawn for large display; the outline stroke thickens it to match lucide's weight at icon sizes.
    // Calibration knob: strokeWidth (path units are 0.1 px of the 430 canvas).
    <svg viewBox="0 0 430 430" className={className} aria-hidden>
      <g transform="translate(0,430) scale(0.1,-0.1)" fill="currentColor" stroke="currentColor" strokeWidth={50} strokeLinejoin="round">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
  const C = icons[name as IconName] ?? Sprout;
  return <C className={className} strokeWidth={1.5} aria-hidden />;
}
