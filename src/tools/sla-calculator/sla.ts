export interface SlaComponent {
  name: string;
  availability: number; // e.g. 99.99
}

export interface SlaResult {
  composite: number;
  downtimeMinutesPerMonth: number;
  downtimeMinutesPerYear: number;
  errorBudgetPercent: number;
  nines: string;
}

const MINUTES_PER_MONTH = 30 * 24 * 60;
const MINUTES_PER_YEAR = 365 * 24 * 60;

export function composeSeries(components: SlaComponent[]): number {
  if (components.length === 0) return 100;
  return components.reduce((acc, c) => acc * (c.availability / 100), 1) * 100;
}

export function composeParallel(components: SlaComponent[]): number {
  if (components.length === 0) return 100;
  // P(all down) = product of (1 - availability)
  const allDownProb = components.reduce((acc, c) => acc * (1 - c.availability / 100), 1);
  return (1 - allDownProb) * 100;
}

export function countNines(availability: number): string {
  if (availability >= 100) return "100%";
  if (availability <= 0) return "0%";
  const s = availability.toFixed(10);
  // Count 9s after the decimal point
  const match = s.match(/^(\d+)\.?(9*)/);
  if (!match) return `${availability}%`;
  const intPart = match[1];
  const nineCount = match[2].length;
  if (intPart === "99" || intPart === "100") {
    if (nineCount === 0) return "two 9s";
    if (nineCount === 1) return "three 9s";
    if (nineCount === 2) return "four 9s";
    if (nineCount === 3) return "five 9s";
    if (nineCount >= 4) return `${nineCount + 2} 9s`;
  }
  return `${availability.toFixed(Math.max(2, nineCount + 2))}%`;
}

export function computeSla(components: SlaComponent[], mode: "series" | "parallel"): SlaResult {
  const composite = mode === "series" ? composeSeries(components) : composeParallel(components);
  const downtimeFraction = 1 - composite / 100;
  const downtimeMinutesPerMonth = downtimeFraction * MINUTES_PER_MONTH;
  const downtimeMinutesPerYear = downtimeFraction * MINUTES_PER_YEAR;
  return {
    composite,
    downtimeMinutesPerMonth,
    downtimeMinutesPerYear,
    errorBudgetPercent: 100 - composite,
    nines: countNines(composite),
  };
}

export const COMMON_SLAS: { label: string; value: number }[] = [
  { label: "99% (two 9s)", value: 99 },
  { label: "99.9% (three 9s)", value: 99.9 },
  { label: "99.95%", value: 99.95 },
  { label: "99.99% (four 9s)", value: 99.99 },
  { label: "99.999% (five 9s)", value: 99.999 },
];

export function formatDowntime(minutes: number): string {
  if (minutes < 1) return `${(minutes * 60).toFixed(1)}s`;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}
