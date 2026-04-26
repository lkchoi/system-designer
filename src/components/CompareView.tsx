import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from "@xyflow/react";
import SystemNode from "./SystemNode";
import StickyNote from "./StickyNote";
import TextNode from "./TextNode";
import ContainerNode from "./ContainerNode";
import LabeledEdge from "./LabeledEdge";
import { loadDesignState } from "../db";
import type { Design } from "../db";

const nodeTypes = {
  system: SystemNode,
  sticky: StickyNote,
  text: TextNode,
  container: ContainerNode,
};
const edgeTypes = { labeled: LabeledEdge };

interface Props {
  designs: Design[];
  compareIds: [string, string];
  onExit: () => void;
}

export default function CompareView({ designs, compareIds, onExit }: Props) {
  const leftDesign = designs.find((d) => d.id === compareIds[0]);
  const rightDesign = designs.find((d) => d.id === compareIds[1]);
  const leftState = loadDesignState(compareIds[0]);
  const rightState = loadDesignState(compareIds[1]);

  return (
    <div className="flex flex-col h-screen bg-surface text-text">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          >
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
          <span className="text-sm font-semibold text-text-bright">
            {leftDesign?.name ?? "Left"}
          </span>
          <span className="text-text-dim text-xs">vs</span>
          <span className="text-sm font-semibold text-text-bright">
            {rightDesign?.name ?? "Right"}
          </span>
        </div>
        <button
          className="flex items-center gap-[5px] px-3.5 py-[5px] rounded-lg text-[13px] font-medium text-text-dim transition-all duration-150 hover:text-text-bright hover:bg-surface-3 bg-surface-2"
          onClick={onExit}
        >
          Exit Compare
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-border relative">
          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-surface-2 border border-border rounded-md text-[11px] font-semibold text-text-dim">
            {leftDesign?.name}
          </div>
          <ReactFlowProvider>
            <ReactFlow
              nodes={leftState.nodes}
              edges={leftState.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultViewport={leftState.viewport}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              fitView={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-surface-2 border border-border rounded-md text-[11px] font-semibold text-text-dim">
            {rightDesign?.name}
          </div>
          <ReactFlowProvider>
            <ReactFlow
              nodes={rightState.nodes}
              edges={rightState.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultViewport={rightState.viewport}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              fitView={false}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
