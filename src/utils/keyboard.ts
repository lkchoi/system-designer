export function isMac(): boolean {
  return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function formatKey(key: string, opts?: { mod?: boolean; shift?: boolean }): string {
  const mac = isMac();
  const parts: string[] = [];
  if (opts?.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (opts?.shift) parts.push(mac ? "⇧" : "Shift");

  const display: Record<string, string> = {
    Escape: "Esc",
    "=": "+",
    "-": "−",
    "0": "0",
    "?": "?",
  };
  parts.push(display[key] ?? key.toUpperCase());
  return parts.join(mac ? "" : "+");
}
