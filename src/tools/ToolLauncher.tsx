import { useState, Suspense } from "react";
import type { ComponentType } from "../types";
import { getToolsForType } from "./index";

interface Props {
  componentType: ComponentType;
}

export default function ToolLauncher({ componentType }: Props) {
  const tools = getToolsForType(componentType);
  const [openToolId, setOpenToolId] = useState<string | null>(null);

  if (tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-semibold text-text-dim">Tools</label>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text bg-surface-2 border border-border transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
            onClick={() => setOpenToolId(tool.id)}
            title={tool.label}
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
              <path d={tool.icon} />
            </svg>
            {tool.label}
          </button>
        ))}
      </div>
      {openToolId && (
        <Suspense fallback={null}>
          {tools.map((tool) => {
            if (tool.id !== openToolId) return null;
            const Component = tool.component;
            return <Component key={tool.id} open onClose={() => setOpenToolId(null)} />;
          })}
        </Suspense>
      )}
    </div>
  );
}
