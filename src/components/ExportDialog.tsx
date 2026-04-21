import { useCallback } from "react";
import { CONVERTERS, type ConverterModule } from "../converters";
import { exportDesign, downloadFile } from "../db/io";

interface Props {
  open: boolean;
  onClose: () => void;
  designId: string;
  designName: string;
}

export default function ExportDialog({ open, onClose, designId, designName }: Props) {
  if (!open) return null;

  const handleExport = useCallback(
    (converter: ConverterModule) => {
      const json = exportDesign(designId);
      const design = JSON.parse(json);
      const result = converter.exportDesign(design);
      const ext = result.filename.match(/\.[^.]+$/)?.[0] ?? "";
      downloadFile(result.content, `${designName}${ext}`, result.mimeType);
      onClose();
    },
    [designId, designName, onClose],
  );

  const diagramFormats = CONVERTERS.filter((c) => c.category === "diagram");
  const iacFormats = CONVERTERS.filter((c) => c.category === "iac");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl px-7 py-6 w-[560px] max-w-[90vw] max-h-[80vh] overflow-y-auto shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-base font-bold text-text-bright mb-5">
          <span>Export Design</span>
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

        {diagramFormats.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-2">
              Diagram
            </div>
            <div className="grid grid-cols-3 gap-2">
              {diagramFormats.map((c) => (
                <FormatTile key={c.id} converter={c} onClick={handleExport} />
              ))}
            </div>
          </div>
        )}

        {iacFormats.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-2">
              Infrastructure as Code
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iacFormats.map((c) => (
                <FormatTile key={c.id} converter={c} onClick={handleExport} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormatTile({
  converter,
  onClick,
}: {
  converter: ConverterModule;
  onClick: (c: ConverterModule) => void;
}) {
  return (
    <button
      className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-left transition-all duration-150 hover:bg-surface-3 hover:border-accent cursor-pointer"
      onClick={() => onClick(converter)}
    >
      <span className="text-[13px] font-medium text-text-bright">{converter.label}</span>
      <span className="text-[11px] text-text-dim leading-tight">{converter.description}</span>
    </button>
  );
}
