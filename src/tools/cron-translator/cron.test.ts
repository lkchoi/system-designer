import { describe, it, expect } from "vitest";
import { parseField, cronToNatural, naturalToCron, getNextRuns, parseTimeStr } from "./cron";

// --------- parseField ---------

describe("parseField", () => {
  it("parses wildcard", () => {
    expect(parseField("*", 0, 59)).toEqual({ type: "all", values: [] });
  });

  it("parses single value", () => {
    expect(parseField("5", 0, 59)).toEqual({ type: "value", values: [5] });
  });

  it("rejects value below min", () => {
    expect(parseField("0", 1, 31)).toBeNull();
  });

  it("rejects value above max", () => {
    expect(parseField("60", 0, 59)).toBeNull();
  });

  it("parses range", () => {
    const result = parseField("1-5", 0, 6);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("range");
    expect(result!.values).toEqual([1, 2, 3, 4, 5]);
    expect(result!.rangeStart).toBe(1);
    expect(result!.rangeEnd).toBe(5);
  });

  it("rejects invalid range", () => {
    expect(parseField("5-1", 0, 6)).toBeNull();
    expect(parseField("0-7", 0, 6)).toBeNull();
  });

  it("parses step with wildcard", () => {
    const result = parseField("*/5", 0, 59);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("step");
    expect(result!.step).toBe(5);
    expect(result!.values).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it("parses step with range", () => {
    const result = parseField("1-10/3", 0, 59);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("step");
    expect(result!.values).toEqual([1, 4, 7, 10]);
  });

  it("rejects step of 0", () => {
    expect(parseField("*/0", 0, 59)).toBeNull();
  });

  it("parses list", () => {
    const result = parseField("1,3,5", 0, 6);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("list");
    expect(result!.values).toEqual([1, 3, 5]);
  });

  it("deduplicates and sorts list", () => {
    const result = parseField("5,1,3,1", 0, 6);
    expect(result!.values).toEqual([1, 3, 5]);
  });

  it("rejects list with out-of-range value", () => {
    expect(parseField("1,8", 0, 6)).toBeNull();
  });
});

// --------- parseTimeStr ---------

describe("parseTimeStr", () => {
  it("parses 24h time", () => {
    expect(parseTimeStr("14:30")).toEqual({ h: 14, m: 30 });
  });

  it("parses hour only", () => {
    expect(parseTimeStr("9")).toEqual({ h: 9, m: 0 });
  });

  it("parses am/pm", () => {
    expect(parseTimeStr("9am")).toEqual({ h: 9, m: 0 });
    expect(parseTimeStr("9pm")).toEqual({ h: 21, m: 0 });
    expect(parseTimeStr("12am")).toEqual({ h: 0, m: 0 });
    expect(parseTimeStr("12pm")).toEqual({ h: 12, m: 0 });
  });

  it("parses time with minutes and am/pm", () => {
    expect(parseTimeStr("3:30 pm")).toEqual({ h: 15, m: 30 });
  });

  it("rejects invalid times", () => {
    expect(parseTimeStr("25:00")).toBeNull();
    expect(parseTimeStr("abc")).toBeNull();
  });
});

// --------- cronToNatural ---------

describe("cronToNatural", () => {
  it("rejects wrong number of fields", () => {
    expect(cronToNatural("* * *").error).not.toBeNull();
  });

  it("rejects invalid field values", () => {
    expect(cronToNatural("60 * * * *").error).not.toBeNull();
  });

  it("every minute", () => {
    expect(cronToNatural("* * * * *").text).toBe("Every minute");
  });

  it("every N minutes", () => {
    expect(cronToNatural("*/5 * * * *").text).toBe("Every 5 minutes");
    expect(cronToNatural("*/15 * * * *").text).toBe("Every 15 minutes");
  });

  it("every hour at minute N", () => {
    expect(cronToNatural("30 * * * *").text).toBe("Every hour at minute 30");
  });

  it("every N hours at minute MM", () => {
    expect(cronToNatural("0 */6 * * *").text).toBe("Every 6 hours at minute 00");
  });

  it("specific time", () => {
    expect(cronToNatural("0 9 * * *").text).toBe("At 9:00 AM");
    expect(cronToNatural("30 14 * * *").text).toBe("At 2:30 PM");
    expect(cronToNatural("0 0 * * *").text).toBe("At 12:00 AM");
  });

  it("list of hours", () => {
    expect(cronToNatural("0 9,17 * * *").text).toBe("At 9:00 AM, 5:00 PM");
  });

  it("range of hours", () => {
    expect(cronToNatural("0 9-17 * * *").text).toBe("Every hour from 9:00 AM to 5:00 PM");
  });

  it("with weekday", () => {
    expect(cronToNatural("0 9 * * 1").text).toBe("At 9:00 AM on Monday");
    expect(cronToNatural("0 9 * * 1-5").text).toBe("At 9:00 AM on weekdays");
  });

  it("with day of month", () => {
    expect(cronToNatural("0 0 1 * *").text).toBe("At 12:00 AM on the 1st");
    expect(cronToNatural("0 0 15 * *").text).toBe("At 12:00 AM on the 15th");
  });

  it("with month", () => {
    expect(cronToNatural("0 0 1 1 *").text).toBe("At 12:00 AM on the 1st in January");
    expect(cronToNatural("0 0 * 3-6 *").text).toBe("At 12:00 AM from March to June");
  });

  it("with multiple day-of-week values", () => {
    expect(cronToNatural("0 9 * * 1,3,5").text).toBe("At 9:00 AM on Monday, Wednesday and Friday");
  });

  it("fallback for step+step", () => {
    expect(cronToNatural("*/5 */2 * * *").text).toBe("every 5 minutes every 2 hours");
  });

  it("fallback for list+list", () => {
    expect(cronToNatural("0,30 9,17 * * *").text).toBe("at minute 0, 30 at hour 9, 17");
  });

  it("full range DOW 0-6 is omitted", () => {
    expect(cronToNatural("0 9 * * 0-6").text).toBe("At 9:00 AM");
  });
});

// --------- naturalToCron ---------

describe("naturalToCron", () => {
  it("empty input returns empty cron", () => {
    expect(naturalToCron("").cron).toBe("");
    expect(naturalToCron("").error).toBeNull();
  });

  it("every minute", () => {
    expect(naturalToCron("every minute").cron).toBe("* * * * *");
  });

  it("every N minutes", () => {
    expect(naturalToCron("every 5 minutes").cron).toBe("*/5 * * * *");
    expect(naturalToCron("every 15 minutes").cron).toBe("*/15 * * * *");
  });

  it("every hour", () => {
    expect(naturalToCron("every hour").cron).toBe("0 * * * *");
    expect(naturalToCron("hourly").cron).toBe("0 * * * *");
  });

  it("every hour at minute N", () => {
    expect(naturalToCron("every hour at minute 30").cron).toBe("30 * * * *");
  });

  it("every N hours", () => {
    expect(naturalToCron("every 6 hours").cron).toBe("0 */6 * * *");
  });

  it("every N hours at minute MM", () => {
    expect(naturalToCron("every 6 hours at minute 00").cron).toBe("00 */6 * * *");
    expect(naturalToCron("every 2 hours at minute 30").cron).toBe("30 */2 * * *");
  });

  it("daily", () => {
    expect(naturalToCron("daily").cron).toBe("0 0 * * *");
    expect(naturalToCron("every day").cron).toBe("0 0 * * *");
  });

  it("daily at time", () => {
    expect(naturalToCron("daily at 9am").cron).toBe("0 9 * * *");
    expect(naturalToCron("every day at 3:30 pm").cron).toBe("30 15 * * *");
  });

  it("at midnight / at noon", () => {
    expect(naturalToCron("at midnight").cron).toBe("0 0 * * *");
    expect(naturalToCron("at noon").cron).toBe("0 12 * * *");
  });

  it("at specific time", () => {
    expect(naturalToCron("at 9:00 am").cron).toBe("0 9 * * *");
    expect(naturalToCron("at 2:30 pm").cron).toBe("30 14 * * *");
  });

  it("weekly", () => {
    expect(naturalToCron("weekly").cron).toBe("0 0 * * 0");
  });

  it("every weekday", () => {
    expect(naturalToCron("every monday").cron).toBe("0 0 * * 1");
    expect(naturalToCron("every friday at 5pm").cron).toBe("0 17 * * 5");
  });

  it("weekdays", () => {
    expect(naturalToCron("weekdays at 9am").cron).toBe("0 9 * * 1-5");
  });

  it("monthly", () => {
    expect(naturalToCron("monthly").cron).toBe("0 0 1 * *");
    expect(naturalToCron("monthly on the 15th").cron).toBe("0 0 15 * *");
  });

  it("yearly", () => {
    expect(naturalToCron("yearly").cron).toBe("0 0 1 1 *");
    expect(naturalToCron("annually").cron).toBe("0 0 1 1 *");
  });

  it("with DOW suffix", () => {
    expect(naturalToCron("at 9:00 am on weekdays").cron).toBe("0 9 * * 1-5");
    expect(naturalToCron("at 9:00 am on monday").cron).toBe("0 9 * * 1");
    expect(naturalToCron("every 5 minutes on monday through friday").cron).toBe("*/5 * * * 1-5");
  });

  it("with DOW list suffix", () => {
    expect(naturalToCron("at 9:00 am on monday, wednesday and friday").cron).toBe("0 9 * * 1,3,5");
  });

  it("with DOM suffix", () => {
    expect(naturalToCron("at 9:00 am on the 1st").cron).toBe("0 9 1 * *");
    expect(naturalToCron("at 9:00 am on the 1st, 15th").cron).toBe("0 9 1,15 * *");
  });

  it("with month suffix", () => {
    expect(naturalToCron("at 9:00 am in january").cron).toBe("0 9 * 1 *");
    expect(naturalToCron("at 9:00 am from march to june").cron).toBe("0 9 * 3-6 *");
  });

  it("with combined suffixes", () => {
    expect(naturalToCron("at 9:00 am on the 1st in january").cron).toBe("0 9 1 1 *");
  });

  it("fallback patterns roundtrip", () => {
    expect(naturalToCron("every 5 minutes every 2 hours").cron).toBe("*/5 */2 * * *");
    expect(naturalToCron("at minute 0, 30 at hour 9, 17").cron).toBe("0,30 9,17 * * *");
  });

  it("returns error for unparseable input", () => {
    const result = naturalToCron("blah blah blah");
    expect(result.cron).toBe("");
    expect(result.error).not.toBeNull();
  });
});

// --------- roundtrip: cronToNatural → naturalToCron ---------

describe("roundtrip: cronToNatural → naturalToCron", () => {
  const cases = [
    "* * * * *",
    "*/5 * * * *",
    "*/15 * * * *",
    "30 * * * *",
    "0 * * * *",
    "0 9 * * *",
    "30 14 * * *",
    "0 0 * * *",
    "0 9,17 * * *",
    "0 9-17 * * *",
    "0 9 * * 1",
    "0 9 * * 1-5",
    "0 9 * * 1,3,5",
    "0 0 1 * *",
    "0 0 15 * *",
    "0 0 1 1 *",
    "0 0 * 3-6 *",
    "0 9 1 1 *",
    "*/5 */2 * * *",
    "0,30 9,17 * * *",
  ];

  for (const cron of cases) {
    it(`roundtrips "${cron}"`, () => {
      const natural = cronToNatural(cron);
      expect(natural.error).toBeNull();

      const back = naturalToCron(natural.text);
      expect(back.error).toBeNull();
      expect(back.cron).toBe(cron);
    });
  }
});

// --------- getNextRuns ---------

describe("getNextRuns", () => {
  it("returns requested count", () => {
    const runs = getNextRuns("* * * * *", 5, new Date(2025, 0, 1, 0, 0));
    expect(runs).toHaveLength(5);
  });

  it("returns correct times for hourly", () => {
    const from = new Date(2025, 0, 1, 10, 0);
    const runs = getNextRuns("0 * * * *", 3, from);
    expect(runs).toHaveLength(3);
    expect(runs[0].getHours()).toBe(11);
    expect(runs[0].getMinutes()).toBe(0);
    expect(runs[1].getHours()).toBe(12);
    expect(runs[2].getHours()).toBe(13);
  });

  it("respects day-of-week constraint", () => {
    // Monday only at 9am
    const from = new Date(2025, 0, 6, 0, 0); // Monday Jan 6
    const runs = getNextRuns("0 9 * * 1", 2, from);
    expect(runs).toHaveLength(2);
    expect(runs[0].getDay()).toBe(1); // Monday
    expect(runs[1].getDay()).toBe(1);
  });

  it("returns empty for invalid expression", () => {
    expect(getNextRuns("invalid", 5)).toEqual([]);
    expect(getNextRuns("* * *", 5)).toEqual([]);
  });

  it("returns empty for impossible schedule", () => {
    // Feb 31 doesn't exist
    const runs = getNextRuns("0 0 31 2 *", 1, new Date(2025, 0, 1));
    expect(runs).toEqual([]);
  });

  it("starts from the given date", () => {
    const from = new Date(2025, 5, 15, 12, 0); // June 15 noon
    const runs = getNextRuns("0 0 * * *", 1, from); // daily at midnight
    expect(runs[0].getFullYear()).toBe(2025);
    expect(runs[0].getMonth()).toBe(5); // June
    expect(runs[0].getDate()).toBe(16); // next day
  });
});
