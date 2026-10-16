import {
  Apple, Bean, Bug, Building2, Camera, Check, Citrus, CircleHelp, CircleStop, ClipboardCheck, ClipboardList, Cloud,
  CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Coins, Droplet, Droplets, Footprints, Hand, Hourglass,
  Keyboard, LeafyGreen, MapPin, MessageCircle, Mic, Minus, Pencil, Plus, Ruler, Search, Shovel, ShoppingBasket,
  ShowerHead, Shrub, SprayCan, Sprout, Sun, TreeDeciduous, TriangleAlert, Volume2, Waves, Wheat, type LucideIcon,
} from "lucide-react";

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
  camera: Camera, mic: Mic, minus: Minus, plus: Plus,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const C = icons[name as IconName] ?? Sprout;
  return <C className={className} strokeWidth={1.75} aria-hidden />;
}
