const FIELD_NAMES = ["minute", "hour", "day of month", "month", "day of week"] as const;

export const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const PRESETS: { label: string; cron: string }[] = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Daily at midnight", cron: "0 0 * * *" },
  { label: "Daily at 9 AM", cron: "0 9 * * *" },
  { label: "Weekly on Monday", cron: "0 0 * * 1" },
  { label: "Monthly on the 1st", cron: "0 0 1 * *" },
  { label: "Weekdays at 9 AM", cron: "0 9 * * 1-5" },
  { label: "Every Sunday at 3 AM", cron: "0 3 * * 0" },
  { label: "Yearly on Jan 1", cron: "0 0 1 1 *" },
];

export interface ParsedField {
  type: "all" | "value" | "range" | "step" | "list";
  values: number[];
  step?: number;
  rangeStart?: number;
  rangeEnd?: number;
}

export function parseField(field: string, min: number, max: number): ParsedField | null {
  if (field === "*") return { type: "all", values: [] };

  // Step: */n or n-m/s
  const stepMatch = field.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[4]);
    if (step < 1) return null;
    const start = stepMatch[2] !== undefined ? parseInt(stepMatch[2]) : min;
    const end = stepMatch[3] !== undefined ? parseInt(stepMatch[3]) : max;
    if (start < min || end > max || start > end) return null;
    const values: number[] = [];
    for (let i = start; i <= end; i += step) values.push(i);
    return { type: "step", values, step, rangeStart: start, rangeEnd: end };
  }

  // List: 1,2,3
  if (field.includes(",")) {
    const parts = field.split(",");
    const values: number[] = [];
    for (const p of parts) {
      const v = parseInt(p);
      if (isNaN(v) || v < min || v > max) return null;
      values.push(v);
    }
    return { type: "list", values: [...new Set(values)].sort((a, b) => a - b) };
  }

  // Range: 1-5
  const rangeMatch = field.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    if (start < min || end > max || start > end) return null;
    const values: number[] = [];
    for (let i = start; i <= end; i++) values.push(i);
    return { type: "range", values, rangeStart: start, rangeEnd: end };
  }

  // Single value
  const v = parseInt(field);
  if (isNaN(v) || v < min || v > max) return null;
  return { type: "value", values: [v] };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${pad(minute)} ${period}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function describeDow(parsed: ParsedField): string {
  if (parsed.type === "all") return "";
  if (parsed.type === "range" && parsed.rangeStart === 1 && parsed.rangeEnd === 5)
    return "on weekdays";
  if (parsed.type === "range" && parsed.rangeStart === 0 && parsed.rangeEnd === 6) return "";
  if (parsed.type === "range")
    return `on ${DAY_NAMES[parsed.rangeStart!]} through ${DAY_NAMES[parsed.rangeEnd!]}`;
  const names = parsed.values.map((v) => DAY_NAMES[v]);
  if (names.length === 1) return `on ${names[0]}`;
  return `on ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface CronToNaturalResult {
  text: string;
  error: string | null;
}

export function cronToNatural(expr: string): CronToNaturalResult {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5)
    return { text: "", error: "Expected 5 fields: minute hour day month weekday" };

  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  const parsed: ParsedField[] = [];
  for (let i = 0; i < 5; i++) {
    const p = parseField(parts[i], ranges[i][0], ranges[i][1]);
    if (!p) return { text: "", error: `Invalid ${FIELD_NAMES[i]} field: "${parts[i]}"` };
    parsed.push(p);
  }

  const [minute, hour, dom, month, dow] = parsed;

  const segments: string[] = [];

  // Frequency
  if (minute.type === "all" && hour.type === "all") {
    segments.push("Every minute");
  } else if (minute.type === "step" && minute.step && hour.type === "all") {
    segments.push(`Every ${minute.step} minutes`);
  } else if (minute.type === "value" && hour.type === "all") {
    segments.push(`Every hour at minute ${minute.values[0]}`);
  } else if (minute.type === "value" && hour.type === "step" && hour.step) {
    segments.push(`Every ${hour.step} hours at minute ${pad(minute.values[0])}`);
  } else if (minute.type === "value" && hour.type === "value") {
    segments.push(`At ${formatTime(hour.values[0], minute.values[0])}`);
  } else if (minute.type === "value" && hour.type === "list") {
    const times = hour.values.map((h) => formatTime(h, minute.values[0]));
    segments.push(`At ${times.join(", ")}`);
  } else if (minute.type === "value" && hour.type === "range") {
    segments.push(
      `Every hour from ${formatTime(hour.rangeStart!, minute.values[0])} to ${formatTime(hour.rangeEnd!, minute.values[0])}`,
    );
  } else {
    // Fallback
    const minDesc =
      minute.type === "all"
        ? "every minute"
        : minute.type === "step"
          ? `every ${minute.step} minutes`
          : `at minute ${minute.values.join(", ")}`;
    const hourDesc =
      hour.type === "all"
        ? "of every hour"
        : hour.type === "step"
          ? `every ${hour.step} hours`
          : `at hour ${hour.values.join(", ")}`;
    segments.push(`${minDesc} ${hourDesc}`);
  }

  // Day of week
  const dowDesc = describeDow(dow);
  if (dowDesc) segments.push(dowDesc);

  // Day of month
  if (dom.type !== "all") {
    if (dom.type === "value") {
      segments.push(`on the ${ordinal(dom.values[0])}`);
    } else if (dom.type === "list") {
      segments.push(`on the ${dom.values.map(ordinal).join(", ")}`);
    } else if (dom.type === "range") {
      segments.push(`from the ${ordinal(dom.rangeStart!)} to the ${ordinal(dom.rangeEnd!)}`);
    }
  }

  // Month
  if (month.type !== "all") {
    if (month.type === "value") {
      segments.push(`in ${MONTH_NAMES[month.values[0]]}`);
    } else if (month.type === "list") {
      const names = month.values.map((v) => MONTH_NAMES[v]);
      segments.push(`in ${names.join(", ")}`);
    } else if (month.type === "range") {
      segments.push(`from ${MONTH_NAMES[month.rangeStart!]} to ${MONTH_NAMES[month.rangeEnd!]}`);
    }
  }

  return { text: segments.join(" "), error: null };
}

export interface NaturalToCronResult {
  cron: string;
  error: string | null;
}

const DAY_NAMES_LC = DAY_NAMES.map((n) => n.toLowerCase());
const MONTH_NAMES_LC = MONTH_NAMES.slice(1).map((n) => n.toLowerCase());
const DAY_RE = DAY_NAMES_LC.join("|");
const MONTH_RE = MONTH_NAMES_LC.join("|");

export function parseTimeStr(str: string): { h: number; m: number } | null {
  const match = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  if (match[3] === "pm" && h < 12) h += 12;
  if (match[3] === "am" && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return { h, m };
}

export function naturalToCron(input: string): NaturalToCronResult {
  let s = input.toLowerCase().trim();
  if (!s) return { cron: "", error: null };

  let minField = "*";
  let hourField = "*";
  let domField = "*";
  let monthField = "*";
  let dowField = "*";

  // --- Strip trailing month modifier ---
  let m = s.match(new RegExp(`\\s+from\\s+(${MONTH_RE})\\s+to\\s+(${MONTH_RE})$`));
  if (m) {
    monthField = `${MONTH_NAMES_LC.indexOf(m[1]) + 1}-${MONTH_NAMES_LC.indexOf(m[2]) + 1}`;
    s = s.slice(0, m.index!).trim();
  }
  if (monthField === "*") {
    m = s.match(new RegExp(`\\s+in\\s+((?:${MONTH_RE})(?:,\\s*(?:${MONTH_RE}))*)$`));
    if (m) {
      const names = m[1].split(/,\s*/);
      const indices = names.map((n) => MONTH_NAMES_LC.indexOf(n) + 1);
      monthField = indices.join(",");
      s = s.slice(0, m.index!).trim();
    }
  }

  // --- Strip trailing DOM modifier ---
  m = s.match(/\s+from\s+the\s+(\d{1,2})(?:st|nd|rd|th)\s+to\s+the\s+(\d{1,2})(?:st|nd|rd|th)$/);
  if (m) {
    domField = `${m[1]}-${m[2]}`;
    s = s.slice(0, m.index!).trim();
  }
  if (domField === "*") {
    m = s.match(/\s+on\s+the\s+(\d{1,2}(?:st|nd|rd|th)(?:,\s*\d{1,2}(?:st|nd|rd|th))*)$/);
    if (m) {
      const ords = m[1].match(/\d+/g)!;
      domField = ords.join(",");
      s = s.slice(0, m.index!).trim();
    }
  }

  // --- Strip trailing DOW modifier ---
  m = s.match(/\s+on\s+weekdays$/);
  if (m) {
    dowField = "1-5";
    s = s.slice(0, m.index!).trim();
  }
  if (dowField === "*") {
    m = s.match(new RegExp(`\\s+on\\s+(${DAY_RE})\\s+through\\s+(${DAY_RE})$`));
    if (m) {
      dowField = `${DAY_NAMES_LC.indexOf(m[1])}-${DAY_NAMES_LC.indexOf(m[2])}`;
      s = s.slice(0, m.index!).trim();
    }
  }
  if (dowField === "*") {
    m = s.match(
      new RegExp(`\\s+on\\s+((?:${DAY_RE})(?:,\\s*(?:${DAY_RE}))*(?:\\s+and\\s+(?:${DAY_RE}))?)$`),
    );
    if (m) {
      const names = m[1].split(/,\s*|\s+and\s+/).filter(Boolean);
      const indices = names.map((n) => DAY_NAMES_LC.indexOf(n));
      if (indices.every((i) => i >= 0)) {
        dowField = indices.join(",");
        s = s.slice(0, m.index!).trim();
      }
    }
  }

  // --- Parse base frequency ---
  if (/^every\s+minute$/.test(s)) {
    // defaults are already * *
  } else if (/^every\s+minute\s+of\s+every\s+hour$/.test(s)) {
    // defaults are already * *
  } else if ((m = s.match(/^every\s+(\d+)\s+minutes?\s+every\s+(\d+)\s+hours?$/))) {
    minField = `*/${m[1]}`;
    hourField = `*/${m[2]}`;
  } else if ((m = s.match(/^every\s+(\d+)\s+minutes?(?:\s+of\s+every\s+hour)?$/))) {
    minField = `*/${m[1]}`;
  } else if ((m = s.match(/^at\s+minute\s+([\d,\s]+)\s+at\s+hour\s+([\d,\s]+)$/))) {
    minField = m[1].replace(/\s/g, "");
    hourField = m[2].replace(/\s/g, "");
  } else if ((m = s.match(/^at\s+minute\s+([\d,\s]+)\s+every\s+(\d+)\s+hours?$/))) {
    minField = m[1].replace(/\s/g, "");
    hourField = `*/${m[2]}`;
  } else if ((m = s.match(/^every\s+(\d+)\s+minutes?\s+at\s+hour\s+([\d,\s]+)$/))) {
    minField = `*/${m[1]}`;
    hourField = m[2].replace(/\s/g, "");
  } else if (/^(every\s+hour|hourly)$/.test(s)) {
    minField = "0";
  } else if ((m = s.match(/^every\s+hour\s+at\s+minute\s+(\d{1,2})$/))) {
    minField = m[1];
  } else if ((m = s.match(/^every\s+(\d+)\s+hours?\s+at\s+minute\s+(\d{1,2})$/))) {
    hourField = `*/${m[1]}`;
    minField = m[2];
  } else if ((m = s.match(/^every\s+(\d+)\s+hours?$/))) {
    minField = "0";
    hourField = `*/${m[1]}`;
  } else if (
    (m = s.match(
      /^every\s+hour\s+from\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)\s+to\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)$/,
    ))
  ) {
    const t1 = parseTimeStr(m[1].trim());
    const t2 = parseTimeStr(m[2].trim());
    if (t1 && t2) {
      minField = `${t1.m}`;
      hourField = `${t1.h}-${t2.h}`;
    }
  } else if ((m = s.match(/^at\s+(.+)$/)) && m[1].includes(",")) {
    const parts = m[1].split(/,\s*/);
    const times = parts.map((p) => parseTimeStr(p.trim()));
    if (times.every((t): t is { h: number; m: number } => t !== null)) {
      minField = `${times[0].m}`;
      hourField = times.map((t) => t.h).join(",");
    }
  } else if ((m = s.match(/^(?:daily|every\s+day)\s+at\s+(.+)$/))) {
    const t = parseTimeStr(m[1].trim());
    if (t) {
      minField = `${t.m}`;
      hourField = `${t.h}`;
    }
  } else if (/^(daily|every\s+day)$/.test(s)) {
    minField = "0";
    hourField = "0";
  } else if (/^at\s+midnight$/.test(s)) {
    minField = "0";
    hourField = "0";
  } else if (/^at\s+noon$/.test(s)) {
    minField = "0";
    hourField = "12";
  } else if (/^(weekly|every\s+week)$/.test(s)) {
    minField = "0";
    hourField = "0";
    if (dowField === "*") dowField = "0";
  } else if ((m = s.match(new RegExp(`^every\\s+(${DAY_RE})(?:\\s+at\\s+(.+))?$`)))) {
    const dayIdx = DAY_NAMES_LC.indexOf(m[1]);
    dowField = `${dayIdx}`;
    if (m[2]) {
      const t = parseTimeStr(m[2].trim());
      if (t) {
        minField = `${t.m}`;
        hourField = `${t.h}`;
      }
    } else {
      minField = "0";
      hourField = "0";
    }
  } else if ((m = s.match(/^(?:every\s+)?weekdays?\s+at\s+(.+)$/))) {
    const t = parseTimeStr(m[1].trim());
    if (t) {
      minField = `${t.m}`;
      hourField = `${t.h}`;
    }
    if (dowField === "*") dowField = "1-5";
  } else if (/^(?:every\s+)?weekdays?$/.test(s)) {
    minField = "0";
    hourField = "9";
    if (dowField === "*") dowField = "1-5";
  } else if (/^(monthly|every\s+month)$/.test(s)) {
    minField = "0";
    hourField = "0";
    if (domField === "*") domField = "1";
  } else if (
    (m = s.match(/^(?:monthly|every\s+month)\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?$/))
  ) {
    minField = "0";
    hourField = "0";
    domField = m[1];
  } else if (/^(yearly|annually|every\s+year)$/.test(s)) {
    minField = "0";
    hourField = "0";
    if (domField === "*") domField = "1";
    if (monthField === "*") monthField = "1";
  } else if ((m = s.match(/^at\s+(.+)$/))) {
    const t = parseTimeStr(m[1].trim());
    if (t) {
      minField = `${t.m}`;
      hourField = `${t.h}`;
    } else {
      return {
        cron: "",
        error:
          'Could not parse. Try phrases like "every 5 minutes", "daily at 9am", "every monday at 3:30 pm"',
      };
    }
  } else {
    return {
      cron: "",
      error:
        'Could not parse. Try phrases like "every 5 minutes", "daily at 9am", "every monday at 3:30 pm"',
    };
  }

  return { cron: `${minField} ${hourField} ${domField} ${monthField} ${dowField}`, error: null };
}

export function getNextRuns(expr: string, count: number, from?: Date): Date[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  const parsed: ParsedField[] = [];
  for (let i = 0; i < 5; i++) {
    const p = parseField(parts[i], ranges[i][0], ranges[i][1]);
    if (!p) return [];
    parsed.push(p);
  }

  function matches(d: Date): boolean {
    const min = d.getMinutes();
    const hr = d.getHours();
    const dom = d.getDate();
    const mon = d.getMonth() + 1;
    const dow = d.getDay();

    const vals = [min, hr, dom, mon, dow];
    for (let i = 0; i < 5; i++) {
      const p = parsed[i];
      if (p.type === "all") continue;
      if (!p.values.includes(vals[i])) return false;
    }
    return true;
  }

  const results: Date[] = [];
  const now = from ?? new Date();
  const cursor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes() + 1,
    0,
    0,
  );
  const limit = 365 * 24 * 60;

  for (let i = 0; i < limit && results.length < count; i++) {
    if (matches(cursor)) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return results;
}
