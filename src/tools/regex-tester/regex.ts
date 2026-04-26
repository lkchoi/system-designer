export interface RegexMatch {
  index: number;
  text: string;
  groups: string[];
}

export interface RegexResult {
  matches: RegexMatch[];
  isValid: boolean;
  error: string | null;
  matchCount: number;
}

export function testRegex(pattern: string, flags: string, input: string): RegexResult {
  if (!pattern) return { matches: [], isValid: true, error: null, matchCount: 0 };

  try {
    const re = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];

    if (flags.includes("g")) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(input)) !== null) {
        matches.push({
          index: m.index,
          text: m[0],
          groups: m.slice(1),
        });
        if (m[0].length === 0) re.lastIndex++; // prevent infinite loop on zero-length match
      }
    } else {
      const m = re.exec(input);
      if (m) {
        matches.push({
          index: m.index,
          text: m[0],
          groups: m.slice(1),
        });
      }
    }

    return { matches, isValid: true, error: null, matchCount: matches.length };
  } catch (e) {
    return {
      matches: [],
      isValid: false,
      error: e instanceof Error ? e.message : "Invalid regex",
      matchCount: 0,
    };
  }
}

export const COMMON_PATTERNS: { label: string; pattern: string; description: string }[] = [
  {
    label: "Email",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    description: "Basic email validation",
  },
  {
    label: "IPv4",
    pattern: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b",
    description: "IPv4 address",
  },
  {
    label: "UUID",
    pattern: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    description: "UUID v4 format",
  },
  { label: "URL path", pattern: "\\/[a-zA-Z0-9/_-]+", description: "URL path segment" },
  {
    label: "ISO date",
    pattern: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}",
    description: "ISO 8601 datetime",
  },
  {
    label: "Semver",
    pattern: "\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?",
    description: "Semantic version",
  },
];
