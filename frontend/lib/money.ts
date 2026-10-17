import { intlLocale, type Lang } from "./i18n";

// The amounts the farmer records have no currency of their own. The pilot is in Morocco: dirhams. Change it with NEXT_PUBLIC_CURRENCY
// (and FA_CURRENCY on the backend, which words the Copilot's answers about spending).
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "MAD";

export const money = (lang: Lang, value: number) =>
  new Intl.NumberFormat(intlLocale(lang), { style: "currency", currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
