import type { SystemNodeData, Endpoint } from "../../types";
import { resolveTechId } from "../iac-mapping";
import type { BundleFile } from "../bundle";
import { scaffoldNodeService } from "./node";
import { scaffoldPythonService } from "./python";
import { scaffoldGoService } from "./go";
import type { ConnectionInfo } from "./concerns/resolve";
import { resolveConcerns } from "./concerns/resolve";
import type { ScaffoldLang } from "./concerns/types";

export type { ConnectionInfo } from "./concerns/resolve";

/**
 * Result of scaffolding a Service node: the files to drop into the bundle
 * (paths already prefixed with `services/<name>/`) plus the build context
 * the compose entry should reference.
 */
export interface ScaffoldResult {
  files: BundleFile[];
  /** Relative path to be set as `build.context` in the compose service. */
  buildContext: string;
  /** The in-container port the scaffolded server listens on. */
  containerPort: number;
  /**
   * Shell command to run inside the service container to execute its tests.
   * The bundle's test.sh runs `docker compose run --rm --no-deps <service>
   * <testCommand>` for every scaffolded service.
   */
  testCommand: string;
}

export interface ScaffoldRequest {
  serviceName: string;
  data: SystemNodeData;
  endpoints: Endpoint[];
  /** Outgoing connections resolved from design edges. Defaults to []. */
  connections?: ConnectionInfo[];
}

function techToLang(techId: string): ScaffoldLang {
  switch (techId) {
    case "python-fastapi":
      return "python";
    case "go":
      return "go";
    default:
      return "node";
  }
}

/**
 * Scaffold a hello-world server in the runtime declared by the node's plan.
 * Falls back to Node.js when the runtime is not yet supported by a template.
 * Resolves scaffold concerns from outgoing connections and injects deps,
 * imports, init, shutdown, and health checks into the generated code.
 */
export function scaffoldService(req: ScaffoldRequest): ScaffoldResult {
  const techId = resolveTechId(req.data.componentType, req.data.plan?.technology ?? "", "docker");
  const lang = techToLang(techId);
  const slots = resolveConcerns(lang, req.connections ?? []);
  switch (techId) {
    case "python-fastapi":
      return scaffoldPythonService(req, slots);
    case "go":
      return scaffoldGoService(req, slots);
    case "nodejs":
    case "grpc":
      return scaffoldNodeService(req, slots);
    default:
      return scaffoldNodeService(req, slots);
  }
}
