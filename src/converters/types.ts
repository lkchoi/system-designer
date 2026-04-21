import type { DesignJSON } from "../db/io";

export type FormatId =
  | "native-json"
  | "excalidraw"
  | "cloudformation"
  | "aws-cdk"
  | "terraform"
  | "kubernetes"
  | "docker-compose"
  | "nomad"
  | "pulumi"
  | "localstack";

export type FormatCategory = "diagram" | "iac";

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export interface ConverterModule {
  id: FormatId;
  label: string;
  description: string;
  category: FormatCategory;
  fileExtensions: string[];
  canImport: boolean;
  exportDesign(design: DesignJSON): ExportResult;
  importDesign?(content: string): DesignJSON;
}
