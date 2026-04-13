import { HOTKEYS } from '../hotkeys';
import type { HotkeyDef } from '../hotkeys';
import { formatKey } from '../utils/keyboard';

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
    <div className="hotkey-overlay" onClick={onClose}>
      <div className="hotkey-card" onClick={e => e.stopPropagation()}>
        <div className="hotkey-header">
          <span>Keyboard Shortcuts</span>
          <button className="hotkey-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="hotkey-grid">
          {[...groups.entries()].map(([category, defs]) => (
            <div key={category} className="hotkey-group">
              <div className="hotkey-category">{category}</div>
              {defs.map(def => (
                <div key={def.id} className="hotkey-row">
                  <span className="hotkey-label">{def.label}</span>
                  <kbd className="hotkey-kbd">
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
