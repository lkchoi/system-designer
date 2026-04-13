import { useEffect } from "react";
import { HOTKEYS } from "../hotkeys";
import { isInputFocused, isMac } from "../utils/keyboard";

export type HotkeyActions = Record<string, () => void>;

export function useHotkeys(actions: HotkeyActions) {
  useEffect(() => {
    const mac = isMac();

    function handler(e: KeyboardEvent) {
      const mod = mac ? e.metaKey : e.ctrlKey;

      for (const def of HOTKEYS) {
        // Modifier checks
        if (def.mod && !mod) continue;
        if (!def.mod && mod) continue;
        if (def.shift && !e.shiftKey) continue;

        // Key match — compare against e.key (handles symbols & digits)
        // For letters, also try case-insensitive match
        const target = def.key;
        const pressed = e.key;
        const match = pressed === target || pressed.toLowerCase() === target.toLowerCase();
        if (!match) continue;

        // For bare (non-shift) keys, reject if shift is held
        // Exception: '?' requires shift on most layouts
        if (!def.shift && !def.mod && e.shiftKey && target !== "?") continue;

        // Guard: skip when input is focused
        if (def.guard && isInputFocused()) continue;

        // Action must be registered
        const action = actions[def.id];
        if (!action) continue;

        e.preventDefault();
        action();
        return; // first match wins
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
