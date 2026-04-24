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
