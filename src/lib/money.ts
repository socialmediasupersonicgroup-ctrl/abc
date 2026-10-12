/**
 * Money helpers. All amounts are integer minor units (e.g. paise for INR).
 * Parsing works on strings so that no binary floating point is involved.
 */

export const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "de-DE" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (AED)", locale: "en-AE" },
  { code: "SGD", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "AUD", label: "Australian Dollar (A$)", locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar (C$)", locale: "en-CA" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export function localeForCurrency(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.locale ?? "en-IN";
}

/** Maximum amount we accept (100 crore in major units) to stay far away from Number.MAX_SAFE_INTEGER. */
export const MAX_MINOR = 1_000_000_000_00;

/**
 * Parses a user supplied decimal string ("1,23,456.78", "1234.5", "₹ 99") into minor units.
 * Returns null for invalid input or more than two decimal places.
 */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const raw = String(input).replace(/[\s,₹$€£]/g, "").replace(/^(INR|USD|EUR|GBP|AED|SGD|AUD|CAD)/i, "");
  if (raw === "") return null;
  const match = /^(-)?(\d+)(?:\.(\d{0,2}))?$/.exec(raw);
  if (!match) return null;
  const [, sign, whole, frac = ""] = match;
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor)) return null;
  return sign ? -minor : minor;
}

/** Converts minor units to a plain decimal string for form inputs ("1234.50"). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor == null) return "";
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Integer division rounding half away from zero. */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) throw new Error("Division by zero");
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (r * 2 >= d ? q + 1 : q);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string) {
  let f = formatterCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(localeForCurrency(currency), { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatterCache.set(currency, f);
  }
  return f;
}

export function formatMoney(minor: number, currency = "INR"): string {
  return formatter(currency).format(minor / 100);
}

/**
 * Short money labels for chart axes and cards. Implemented by hand (instead of Intl compact notation)
 * so server and browser render identical text; INR uses the Indian lakh/crore system.
 */
export function formatMoneyCompact(minor: number, currency = "INR"): string {
  const major = minor / 100;
  const abs = Math.abs(major);
  const sign = major < 0 ? "-" : "";
  const steps: [number, string][] =
    currency === "INR"
      ? [
          [1e7, "Cr"],
          [1e5, "L"],
          [1e3, "K"],
        ]
      : [
          [1e9, "B"],
          [1e6, "M"],
          [1e3, "K"],
        ];
  const symbol = currencySymbol(currency);
  for (const [value, suffix] of steps) {
    if (abs >= value) {
      const n = abs / value;
      const text = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
      return `${sign}${symbol}${text}${suffix}`;
    }
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

export function currencySymbol(currency = "INR"): string {
  const parts = formatter(currency).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

/** Percent in basis points to a display string (1800 -> "18%"; 1250 -> "12.5%"). */
export function formatBps(bps: number): string {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "")}%`;
}

/** Parses "18", "12.5", "7.25" into basis points. */
export function parsePercentToBps(input: string | number | null | undefined): number | null {
  if (input == null || String(input).trim() === "") return null;
  const match = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(String(input).trim().replace(/%$/, ""));
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number(((match[2] ?? "") + "00").slice(0, 2));
  return bps;
}
