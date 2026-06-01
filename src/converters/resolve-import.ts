import { detectFormat } from "./detect";
import type { ConverterModule } from "./types";
import { parseDesignJSON, type DesignJSON } from "../db/io";

export interface ImportResolution {
  design: DesignJSON;
  warnings: string[];
}

/**
 * Detect the format of an imported file, convert it to a DesignJSON, and
 * collect any non-fatal warnings. Throws an Error with a user-facing message
 * when the file cannot be imported at all (unknown/unsupported format,
 * malformed content, etc.).
 */
export function resolveImport(
  content: string,
  filename: string,
  importFormats: ConverterModule[],
): ImportResolution {
  const formatId = detectFormat(filename, content);

  let design: DesignJSON;
  if (formatId && formatId !== "native-json") {
    const converter = importFormats.find((c) => c.id === formatId);
    if (!converter?.importDesign) {
      throw new Error(`No importer is available for ${formatId} files.`);
    }
    design = converter.importDesign(content);
  } else {
    design = parseDesignJSON(content);
  }

  const warnings: string[] = [];
  if (design.nodes.length === 0) {
    warnings.push("No components were recognized in this file, so the imported design is empty.");
  }

  return { design, warnings };
}
