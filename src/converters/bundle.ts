import JSZip from "jszip";
import type { ExportResult } from "./types";

/**
 * A virtual file in an export bundle.
 *
 * Paths use forward slashes and are relative to the bundle root
 * (e.g. "docker-compose.yaml", "init/postgres/schema.sql").
 *
 * String content is encoded as UTF-8; Uint8Array is written verbatim
 * (for binary assets like compiled jars or favicons).
 */
export interface BundleFile {
  path: string;
  content: string | Uint8Array;
  /** When true, mark the file as executable in the zip's Unix permissions. */
  executable?: boolean;
}

/**
 * Pack a set of virtual files into a downloadable zip Blob.
 */
export async function exportBundle(
  files: BundleFile[],
  bundleName: string,
): Promise<ExportResult> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content, {
      unixPermissions: file.executable ? 0o755 : 0o644,
    });
  }
  const blob = await zip.generateAsync({ type: "blob", platform: "UNIX" });
  return {
    content: blob,
    filename: `${bundleName}.zip`,
    mimeType: "application/zip",
  };
}
