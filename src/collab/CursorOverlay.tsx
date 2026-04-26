/**
 * CursorOverlay — renders remote users' cursors on the canvas.
 *
 * Renders inside ReactFlow's viewport layer so cursors track with
 * pan/zoom. Each cursor shows a colored arrow and the user's name.
 *
 * Also shows colored selection rings around nodes selected by remote
 * users (via CSS class injection).
 */

import { useEffect, useRef } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useAwareness, type UserPresence } from "./useAwareness";

export function CursorOverlay() {
  const { remoteUsers, setCursor } = useAwareness();
  const { screenToFlowPosition } = useReactFlow();
  const paneRef = useRef<Element | null>(null);

  // Attach mousemove to the ReactFlow pane element directly
  useEffect(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return;
    paneRef.current = pane;

    const onMove = (e: Event) => {
      const me = e as MouseEvent;
      const pos = screenToFlowPosition({ x: me.clientX, y: me.clientY });
      setCursor(pos);
    };

    const onLeave = () => setCursor(null);

    pane.addEventListener("pointermove", onMove);
    pane.addEventListener("pointerleave", onLeave);
    return () => {
      pane.removeEventListener("pointermove", onMove);
      pane.removeEventListener("pointerleave", onLeave);
    };
  }, [screenToFlowPosition, setCursor]);

  return (
    <>
      {/* Remote cursors */}
      {remoteUsers.map((user) =>
        user.cursor ? <RemoteCursor key={user.clientId} user={user} /> : null,
      )}
      {/* Selection indicators */}
      <SelectionIndicators users={remoteUsers} />
    </>
  );
}

function RemoteCursor({ user }: { user: UserPresence }) {
  const { x, y, zoom } = useViewport();
  if (!user.cursor) return null;

  // Convert flow coordinates to viewport-relative position
  const screenX = user.cursor.x * zoom + x;
  const screenY = user.cursor.y * zoom + y;

  return (
    <div
      style={{
        position: "absolute",
        left: screenX,
        top: screenY,
        pointerEvents: "none",
        zIndex: 51,
        transition: "left 0.05s linear, top 0.05s linear",
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill={user.color}
        stroke="white"
        strokeWidth="1"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
      >
        <path d="M0 0L16 12L8 12L4 20Z" />
      </svg>
      {/* Name label */}
      <span
        style={{
          position: "absolute",
          left: 16,
          top: 12,
          backgroundColor: user.color,
          color: "white",
          fontSize: "11px",
          fontWeight: 500,
          padding: "1px 6px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
          lineHeight: "18px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        {user.name}
      </span>
    </div>
  );
}

function SelectionIndicators({ users }: { users: UserPresence[] }) {
  useEffect(() => {
    const styleId = "collab-selection-indicators";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    const rules = users
      .filter((u) => u.selectedNodeId)
      .map(
        (u) =>
          `.react-flow__node[data-id="${u.selectedNodeId}"] { box-shadow: 0 0 0 2px ${u.color}; border-radius: 8px; }`,
      )
      .join("\n");

    style.textContent = rules;

    return () => {
      style!.textContent = "";
    };
  }, [users]);

  return null;
}

export { useAwareness };
