const ACRONYMS = new Set(["api", "cdn", "dns", "etl", "cqrs", "cdc"]);

export function displayType(type: string): string {
  return type
    .split("-")
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
