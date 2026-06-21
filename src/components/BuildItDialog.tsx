/**
 * "Build it" dialog.
 *
 * Calls `buildOutDesign()` and writes the produced files. The dialog is
 * intentionally a small modal — no streaming, no key handling, no
 * progress bar. Just emit files and surface the result.
 *
 * Output target:
 *   - File System Access API (Chrome/Edge): user picks a folder once,
 *     we write straight into it. Subsequent runs re-prompt for the same
 *     folder (browser-mediated; we can't persist the handle securely
 *     across origins).
 *   - Zip fallback (Safari/Firefox): one download containing the slug
 *     subfolders.
 *
 * Scope:
 *   - All nodes (default).
 *   - Only selected node (when exactly one node is selected — gives
 *     the per-node experience without a context-menu system).
 */

import { useCallback, useMemo, useState } from "react";
import JSZip from "jszip";
import type { Edge, Node } from "@xyflow/react";
import { buildOutDesign, type BuildOutResult } from "../converters/buildout";

interface Props {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  designName: string;
  selectedNodeId?: string | null;
}

type Scope = "all" | "selected";

const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;

export default function BuildItDialog({
  open,
  onClose,
  nodes,
  edges,
  designName,
  selectedNodeId,
}: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BuildOutResult | null>(null);
  const [writeStatus, setWriteStatus] = useState<string | null>(null);

  const canScopeToSelection = !!selectedNodeId;

  const onRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setWriteStatus(null);
    try {
      const out = await buildOutDesign(nodes, edges, {
        onlyNodeIds: scope === "selected" && selectedNodeId ? [selectedNodeId] : undefined,
      });
      setResult(out);
    } finally {
      setRunning(false);
    }
  }, [nodes, edges, scope, selectedNodeId]);

  const onWriteFolder = useCallback(async () => {
    if (!result) return;
    setWriteStatus("Writing…");
    try {
      // The FSA picker call must happen synchronously in a user gesture,
      // so we keep the await chain short here.
      const handle = await (
        window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker();
      for (const f of result.files) {
        await writeFileToHandle(handle, f.path, f.contents);
      }
      setWriteStatus(`Wrote ${result.files.length} files`);
    } catch (err) {
      // User cancelled folder picker or write failed.
      setWriteStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [result]);

  const onDownloadZip = useCallback(async () => {
    if (!result) return;
    setWriteStatus("Building zip…");
    const zip = new JSZip();
    for (const f of result.files) zip.file(f.path, f.contents);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(designName)}-build.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setWriteStatus(`Downloaded ${result.files.length} files`);
  }, [result, designName]);

  const filesByFolder = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!result) return map;
    for (const f of result.files) {
      const folder = f.path.split("/")[0];
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(f.path.slice(folder.length + 1));
    }
    return map;
  }, [result]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl px-7 py-6 w-[560px] max-w-[90vw] max-h-[80vh] overflow-y-auto shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-base font-bold text-text-bright mb-2">
          <span>Build it</span>
          <button
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-dim transition-all duration-150 hover:bg-surface-3 hover:text-text-bright"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="text-[12px] text-text-dim mb-4 leading-snug">
          Generates implementation artifacts per node. LLM-driven nodes (service,
          serverless, cron, webhook, stream-processor) emit a prompt bundle —
          feed <code className="bg-surface-2 px-1 rounded">prompt.md</code> to
          your preferred LLM tool. Other nodes emit final config / schema files
          directly.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <label className="text-[12px] font-semibold text-text-dim">Scope</label>
          <div className="flex gap-2">
            <ScopeButton
              active={scope === "all"}
              onClick={() => setScope("all")}
              label="All nodes"
              sub={`${nodes.length} on canvas`}
            />
            <ScopeButton
              active={scope === "selected"}
              onClick={() => canScopeToSelection && setScope("selected")}
              disabled={!canScopeToSelection}
              label="Selected only"
              sub={canScopeToSelection ? "1 selected" : "select a node first"}
            />
          </div>
        </div>

        {!result && (
          <button
            className="w-full bg-accent text-white font-semibold rounded-lg px-4 py-2.5 transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            onClick={onRun}
            disabled={running}
          >
            {running ? "Building…" : "Build"}
          </button>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <ResultSummary result={result} />

            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto border border-border rounded-md p-2 bg-surface-2">
              {[...filesByFolder.entries()].map(([folder, files]) => (
                <div key={folder} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-mono text-accent">{folder}/</span>
                  {files.map((f) => (
                    <span key={f} className="text-[11px] font-mono text-text-dim pl-3">
                      {f}
                    </span>
                  ))}
                </div>
              ))}
              {result.files.length === 0 && (
                <span className="text-[11px] text-text-dim italic">No files to write.</span>
              )}
            </div>

            <div className="flex gap-2">
              {FSA_SUPPORTED && (
                <button
                  className="flex-1 bg-accent text-white font-semibold rounded-lg px-3 py-2 text-sm transition-opacity duration-150 hover:opacity-90"
                  onClick={onWriteFolder}
                >
                  Write to folder…
                </button>
              )}
              <button
                className="flex-1 bg-surface-3 text-text-bright font-semibold rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-2 border border-border"
                onClick={onDownloadZip}
              >
                Download .zip
              </button>
            </div>

            {!FSA_SUPPORTED && (
              <p className="text-[10px] text-text-dim italic">
                Folder writes need Chrome or Edge. Use the .zip on other browsers.
              </p>
            )}

            {writeStatus && (
              <p className="text-[11px] text-text-dim text-center">{writeStatus}</p>
            )}

            <button
              className="text-[11px] text-text-dim hover:text-text-bright transition-colors mt-1"
              onClick={() => setResult(null)}
            >
              ↺ Rebuild
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeButton({
  active,
  disabled,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-3 py-2 rounded-lg border text-left transition-colors duration-150 ${
        active
          ? "bg-accent border-accent text-white"
          : disabled
            ? "bg-surface-2 border-border text-text-dim opacity-50 cursor-not-allowed"
            : "bg-surface-2 border-border text-text-bright hover:border-accent"
      }`}
    >
      <div className="text-[13px] font-semibold">{label}</div>
      <div className="text-[10px] opacity-80">{sub}</div>
    </button>
  );
}

function ResultSummary({ result }: { result: BuildOutResult }) {
  const llmBundles = result.files.filter((f) => f.path.endsWith("/prompt.md")).length;
  const otherFiles = result.files.length - llmBundles;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="bg-surface-2 border border-border rounded-md p-2">
        <div className="text-[18px] font-bold text-text-bright">{llmBundles}</div>
        <div className="text-[10px] text-text-dim uppercase tracking-wide">bundles</div>
      </div>
      <div className="bg-surface-2 border border-border rounded-md p-2">
        <div className="text-[18px] font-bold text-text-bright">{otherFiles}</div>
        <div className="text-[10px] text-text-dim uppercase tracking-wide">files</div>
      </div>
      <div className="bg-surface-2 border border-border rounded-md p-2">
        <div
          className={`text-[18px] font-bold ${result.errors.length > 0 ? "text-[#ef4444]" : "text-text-bright"}`}
        >
          {result.errors.length + result.skipped.length}
        </div>
        <div className="text-[10px] text-text-dim uppercase tracking-wide">
          skipped/errors
        </div>
      </div>
    </div>
  );
}

/**
 * Walk a relative path like "orders-service/handlers.ts" and write into
 * the chosen directory, creating intermediate folders along the way.
 *
 * FSA's directory handle has no "mkdir -p" — we have to walk each
 * segment via getDirectoryHandle({ create: true }).
 */
async function writeFileToHandle(
  root: FileSystemDirectoryHandle,
  relPath: string,
  contents: string,
): Promise<void> {
  const parts = relPath.split("/");
  const filename = parts.pop()!;
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
}
