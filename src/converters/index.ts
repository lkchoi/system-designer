import type { ConverterModule, FormatId } from "./types";
import { nativeJsonConverter } from "./native-json";
import { excalidrawConverter } from "./excalidraw";
import { cloudformationConverter } from "./cloudformation";
import { terraformConverter } from "./terraform";
import { kubernetesConverter } from "./kubernetes";
import { awsCdkConverter } from "./aws-cdk";
import { pulumiConverter } from "./pulumi";
import { dockerComposeConverter } from "./docker-compose";
import { nomadConverter } from "./nomad";
import { localstackConverter } from "./localstack";
import { openapiConverter } from "./openapi";

export const CONVERTERS: ConverterModule[] = [
  nativeJsonConverter,
  excalidrawConverter,
  cloudformationConverter,
  terraformConverter,
  kubernetesConverter,
  awsCdkConverter,
  pulumiConverter,
  dockerComposeConverter,
  nomadConverter,
  localstackConverter,
  openapiConverter,
];

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

export { detectFormat } from "./detect";
export type { ConverterModule, FormatId, FormatCategory, ExportResult } from "./types";
