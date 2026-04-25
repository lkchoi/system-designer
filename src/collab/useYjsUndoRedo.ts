/**
 * useYjsUndoRedo — per-user undo/redo backed by Yjs UndoManager.
 *
 * Same interface as the existing useUndoRedo hook:
 *   { takeSnapshot, undo, redo, canUndo, canRedo }
 *
 * When doc is null (local mode), this hook is inert. The existing
 * snapshot-based useUndoRedo continues to handle undo/redo.
 *
 * When doc is active (collab mode), UndoManager tracks only local
 * changes (via LOCAL_ORIGIN) so each user's undo is independent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { useCollab } from "./provider";
import { LOCAL_ORIGIN } from "./sync";

export function useYjsUndoRedo() {
  const { doc, nodesMap, edgesMap } = useCollab();
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Create/destroy UndoManager when doc changes
  useEffect(() => {
    if (!doc || !nodesMap || !edgesMap) {
      undoManagerRef.current = null;
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    const um = new Y.UndoManager([nodesMap, edgesMap], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 500,
    });

    const updateState = () => {
      setCanUndo(um.undoStack.length > 0);
      setCanRedo(um.redoStack.length > 0);
    };

    um.on("stack-item-added", updateState);
    um.on("stack-item-popped", updateState);
    undoManagerRef.current = um;

    return () => {
      um.destroy();
      undoManagerRef.current = null;
    };
  }, [doc, nodesMap, edgesMap]);

  const takeSnapshot = useCallback(() => {
    undoManagerRef.current?.stopCapturing();
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    /** True when a Y.Doc is active and UndoManager is managing undo. */
    active: undoManagerRef.current !== null,
  };
}
