/**
 * useCollabState — dual-mode state wrapper for nodes and edges.
 *
 * Local mode (doc is null): passes through to useState. Zero overhead.
 * Collab mode (doc is active): mutations write to Y.Doc; observation
 * callbacks update React state from Y.Doc for remote changes.
 *
 * Phase 1: always local mode (CollabProvider returns null doc).
 * Phase 2 will add the collab-mode logic.
 */

import { useState } from "react";
import type { Edge } from "@xyflow/react";
import type { Node } from "@xyflow/react";

/**
 * Drop-in replacement for useState<Node[]> + useState<Edge[]>.
 * Returns [nodes, setNodes, edges, setEdges].
 */
export function useCollabState<N extends Node>(
  initialNodes: N[],
  initialEdges: Edge[],
): [N[], React.Dispatch<React.SetStateAction<N[]>>, Edge[], React.Dispatch<React.SetStateAction<Edge[]>>] {
  // Phase 1: always local mode — straight useState pass-through.
  // Phase 2 will check useCollab().doc and branch to Y.Doc-backed state.
  const [nodes, setNodes] = useState<N[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  return [nodes, setNodes, edges, setEdges];
}
