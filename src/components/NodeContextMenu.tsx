/**
 * Per-node right-click menu. Today only exposes "Build it" — designed
 * to grow as more per-node actions land.
 *
 * Positioning: rendered as a fixed-position div at the cursor location
 * passed in. We don't use a portal because the menu is small, anchored
 * to the page, and clicks outside close it via the document listener.
 */

import { useEffect } from "react";
import type { Node } from "@xyflow/react";

interface Props {
  /** The node the menu is anchored to. */
  node: Node;
  /** Screen coordinates of the right-click event. */
  position: { x: number; y: number };
  /** Invoked when user picks "Build it". */
  onBuildIt: (node: Node) => void;
  /** Invoked to dismiss (click-outside, Esc). */
  onClose: () => void;
}

export default function NodeContextMenu({ node, position, onBuildIt, onClose }: Props) {
  // Close on Escape or any outside click. ReactFlow swallows context-menu
  // events on its own elements, so we listen on document.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMouseDown() {
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  return (
    <div
      role="menu"
      className="fixed z-[200] min-w-[180px] bg-surface border border-border rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1"
      style={{ left: position.x, top: position.y }}
      // Stop the document listener from firing for clicks inside the menu.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-dim border-b border-border mb-1">
        {(node.data as { label?: string })?.label ?? node.id}
      </div>
      <button
        role="menuitem"
        className="w-full text-left px-3 py-1.5 text-[13px] text-text-bright hover:bg-surface-2 flex items-center gap-2"
        onClick={() => {
          onBuildIt(node);
          onClose();
        }}
      >
        {/* Hammer icon — same as toolbar Build it. */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4l5.5 5.5-2 2L12.5 6z" />
          <path d="M12.5 6L4 14.5l3 3 8.5-8.5" />
          <path d="M7 17.5l-3 3" />
        </svg>
        Build it…
      </button>
    </div>
  );
}
