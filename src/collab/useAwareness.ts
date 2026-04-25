/**
 * useAwareness — cursor presence and user identity.
 *
 * Tracks local user's cursor position and selected node, broadcasts
 * via Yjs awareness protocol, observes remote users' state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useCollab } from "./provider";
import * as awarenessProtocol from "y-protocols/awareness";

export interface UserPresence {
  clientId: number;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
}

const COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

const CURSOR_THROTTLE_MS = 33; // ~30fps

function getOrCreateUserName(): string {
  const key = "collab-user-name";
  let name = localStorage.getItem(key);
  if (!name) {
    name = `User ${Math.floor(Math.random() * 9000 + 1000)}`;
    localStorage.setItem(key, name);
  }
  return name;
}

function getColor(clientId: number): string {
  return COLORS[clientId % COLORS.length];
}

export function useAwareness() {
  const { provider } = useCollab();
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);
  const lastCursorUpdate = useRef(0);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);

  // Set up awareness
  useEffect(() => {
    if (!provider) {
      awarenessRef.current = null;
      setRemoteUsers([]);
      return;
    }

    const awareness = provider.awareness;
    awarenessRef.current = awareness;

    // Set local user state
    const name = getOrCreateUserName();
    const color = getColor(awareness.clientID);
    awareness.setLocalStateField("user", { name, color });
    awareness.setLocalStateField("cursor", null);
    awareness.setLocalStateField("selectedNodeId", null);

    // Observe changes
    const onChange = () => {
      const states = awareness.getStates();
      const users: UserPresence[] = [];
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return; // skip self
        const user = state.user as { name: string; color: string } | undefined;
        if (!user) return;
        users.push({
          clientId,
          name: user.name,
          color: user.color,
          cursor: (state.cursor as { x: number; y: number } | null) ?? null,
          selectedNodeId: (state.selectedNodeId as string | null) ?? null,
        });
      });
      setRemoteUsers(users);
    };

    awareness.on("change", onChange);
    onChange(); // initial

    return () => {
      awareness.off("change", onChange);
    };
  }, [provider]);

  // Update local cursor position (throttled)
  const setCursor = useCallback(
    (pos: { x: number; y: number } | null) => {
      const now = Date.now();
      if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return;
      lastCursorUpdate.current = now;
      awarenessRef.current?.setLocalStateField("cursor", pos);
    },
    [],
  );

  // Update local selected node
  const setSelectedNode = useCallback(
    (nodeId: string | null) => {
      awarenessRef.current?.setLocalStateField("selectedNodeId", nodeId);
    },
    [],
  );

  return {
    remoteUsers,
    setCursor,
    setSelectedNode,
  };
}
