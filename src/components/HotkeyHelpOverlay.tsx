import { HOTKEYS } from "../hotkeys";
import type { HotkeyDef } from "../hotkeys";
import { formatKey } from "../utils/keyboard";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HotkeyHelpOverlay({ open, onClose }: Props) {
  if (!open) return null;

  const groups = new Map<string, HotkeyDef[]>();
  for (const def of HOTKEYS) {
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl px-7 py-6 w-[520px] max-w-[90vw] max-h-[80vh] overflow-y-auto shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-base font-bold text-text-bright mb-5">
          <span>Keyboard Shortcuts</span>
          <button
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-dim transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
            onClick={onClose}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {[...groups.entries()].map(([category, defs]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-0.5">
                {category}
              </div>
              {defs.map((def) => (
                <div key={def.id} className="flex items-center justify-between gap-3 py-[3px]">
                  <span className="text-[13px] text-text">{def.label}</span>
                  <kbd className="font-mono text-[11px] font-medium text-text-bright bg-surface-3 border border-border rounded-[5px] px-[7px] py-0.5 whitespace-nowrap leading-normal">
                    {formatKey(def.key, { mod: def.mod, shift: def.shift })}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
