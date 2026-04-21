import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import { parseDesignJSON } from "../db/io";

export const nativeJsonConverter: ConverterModule = {
  id: "native-json",
  label: "JSON",
  description: "Native format with full fidelity",
  category: "diagram",
  fileExtensions: [".json"],
  canImport: true,

  exportDesign(design: DesignJSON) {
    return {
      content: JSON.stringify(design, null, 2),
      filename: `${design.name}.json`,
      mimeType: "application/json",
    };
  },

  importDesign(content: string) {
    return parseDesignJSON(content);
  },
};
