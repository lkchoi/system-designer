import type { FormatId } from "./types";

/**
 * Auto-detect the format of an imported file based on filename and content.
 */
export function detectFormat(filename: string, content: string): FormatId | null {
  const lower = filename.toLowerCase();

  // Unambiguous file extensions
  if (lower.endsWith(".excalidraw")) return "excalidraw";
  if (lower.endsWith(".tf.json")) return "terraform";
  if (lower.endsWith(".nomad.json")) return "nomad";

  // JSON files — inspect content
  if (lower.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content);

      // Excalidraw
      if (parsed.type === "excalidraw") return "excalidraw";

      // Native system-designer format
      if (parsed.version && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return "native-json";
      }

      // CloudFormation JSON
      if (parsed.AWSTemplateFormatVersion || parsed.Resources) return "cloudformation";

      // Terraform JSON
      if (parsed.terraform || parsed.resource || parsed.provider) return "terraform";

      // Nomad JSON job spec
      if (parsed.job) return "nomad";
    } catch {
      // Not valid JSON
    }
    return "native-json"; // default for .json
  }

  // YAML files — inspect content
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    // CloudFormation
    if (content.includes("AWSTemplateFormatVersion") || content.includes("AWS::")) {
      return "cloudformation";
    }

    // Kubernetes — look for apiVersion + kind patterns
    if (content.includes("apiVersion:") && content.includes("kind:")) {
      return "kubernetes";
    }

    // docker-compose
    if (content.includes("services:") && !content.includes("apiVersion:")) {
      return "docker-compose";
    }

    return "cloudformation"; // default for ambiguous YAML
  }

  return null;
}
