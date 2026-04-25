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
  | "localstack"
  | "openapi";

export type FormatCategory = "diagram" | "iac" | "api";

export interface ExportResult {
  content: string | Blob;
  filename: string;
  mimeType: string;
}

export interface ExportOptions {
  /**
   * When true, the local-deploy bundle injects LocalStack for AWS services
   * (Lambda, SNS, Kinesis, EventBridge, SQS) instead of swapping in OSS
   * equivalents. Has no effect for non-AWS exporters.
   */
  preferLocalStack?: boolean;
  /**
   * When true, the local-deploy bundle includes a generated CLAUDE.md so a
   * Claude Code session opened in the exported project starts with a map of
   * services, commands, and conventions. No effect for non-bundle exporters.
   */
  includeClaudeMd?: boolean;
}

export interface ConverterModule {
  id: FormatId;
  label: string;
  description: string;
  category: FormatCategory;
  fileExtensions: string[];
  canImport: boolean;
  exportDesign(design: DesignJSON, options?: ExportOptions): ExportResult | Promise<ExportResult>;
  importDesign?(content: string): DesignJSON;
}
