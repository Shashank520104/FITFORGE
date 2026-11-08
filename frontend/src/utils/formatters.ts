export function formatNumber(
  value: number | string | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

export const poundsPerKilogram = 2.2046226218;

export function displayWeight(
  kilograms: number,
  units: "metric" | "imperial",
): string {
  return formatNumber(
    units === "imperial" ? kilograms * poundsPerKilogram : kilograms,
  );
}

export function weightInKilograms(
  value: number,
  units: "metric" | "imperial",
): number {
  return units === "imperial" ? value / poundsPerKilogram : value;
}

export function weightInDisplayUnits(
  kilograms: number,
  units: "metric" | "imperial",
): number {
  return units === "imperial" ? kilograms * poundsPerKilogram : kilograms;
}

export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function localDateAtNoon(value: string): Date {
  return new Date(`${dateOnly(value)}T12:00:00`);
}

export function chartDayLabel(value: string): string {
  const date = localDateAtNoon(value);
  return date.toLocaleDateString(undefined, { weekday: "short" });
}
