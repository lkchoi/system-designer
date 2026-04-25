import { HOTKEYS } from "../hotkeys";
import type { HotkeyDef } from "../hotkeys";
import { formatKey } from "../utils/keyboard";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER = [
  "Mode",
  "Canvas",
  "Flow Path",
  "Panels",
  "Quick Add",
  "Tools",
  "Help",
] as const;

function KeyBadge({ def }: { def: HotkeyDef }) {
  const parts = formatKey(def.key, { mod: def.mod, shift: def.shift }).split(/(?=[⌘⇧])|(?<=⌘|⇧)|\+/);
  return (
    <span className="flex items-center gap-[3px] shrink-0">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-text-bright bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[4px] min-w-[22px] h-[22px] px-[5px] leading-none shadow-[0_1px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

export default function HotkeyHelpOverlay({ open, onClose }: Props) {
  if (!open) return null;

  const groups = new Map<string, HotkeyDef[]>();
  for (const def of HOTKEYS) {
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }

  // Split categories into two columns for balanced layout
  const orderedCategories = CATEGORY_ORDER.filter((c) => groups.has(c));
  const mid = Math.ceil(orderedCategories.length / 2);
  const leftCol = orderedCategories.slice(0, mid);
  const rightCol = orderedCategories.slice(mid);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-[680px] max-w-[92vw] max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
            </svg>
            <span className="text-base font-bold text-text-bright">Keyboard Shortcuts</span>
          </div>
          <button
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-dim transition-all duration-150 hover:bg-surface-2 hover:text-text-bright"
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

        <div className="px-7 py-5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-x-10 gap-y-0">
            {[leftCol, rightCol].map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-5">
                {col.map((category) => {
                  const defs = groups.get(category)!;
                  return (
                    <div key={category}>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">
                        {category}
                      </div>
                      <div className="flex flex-col">
                        {defs.map((def) => (
                          <div
                            key={def.id}
                            className="flex items-center justify-between gap-4 py-[5px] px-2 -mx-2 rounded-md transition-colors duration-100 hover:bg-surface-2"
                          >
                            <span className="text-[13px] text-text">{def.label}</span>
                            <KeyBadge def={def} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="px-7 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-text-dim">
            Press <kbd className="font-mono text-[10px] font-semibold text-text-bright bg-surface-3 border border-border rounded-[3px] px-1 py-0.5 mx-0.5">?</kbd> to toggle this overlay
          </span>
          <button
            className="text-[11px] text-text-dim transition-colors duration-150 hover:text-text-bright"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
