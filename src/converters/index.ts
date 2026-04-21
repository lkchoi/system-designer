import type { ConverterModule, FormatId } from "./types";
import { nativeJsonConverter } from "./native-json";
import { excalidrawConverter } from "./excalidraw";

export const CONVERTERS: ConverterModule[] = [nativeJsonConverter, excalidrawConverter];

export function getConverter(id: FormatId): ConverterModule {
  const c = CONVERTERS.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown format: ${id}`);
  return c;
}

export function getExportFormats(): ConverterModule[] {
  return CONVERTERS;
}

export function getImportFormats(): ConverterModule[] {
  return CONVERTERS.filter((c) => c.canImport);
}

export type { ConverterModule, FormatId, FormatCategory, ExportResult } from "./types";
