import type { SystemNodeData, Endpoint } from "../../types";
import { resolveTechId } from "../iac-mapping";
import type { BundleFile } from "../bundle";
import { scaffoldNodeService } from "./node";
import { scaffoldPythonService } from "./python";
import { scaffoldGoService } from "./go";

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
}

/**
 * Scaffold a hello-world server in the runtime declared by the node's plan.
 * Falls back to Node.js when the runtime is not yet supported by a template.
 */
export function scaffoldService(req: ScaffoldRequest): ScaffoldResult {
  const techId = resolveTechId(req.data.componentType, req.data.plan?.technology ?? "", "docker");
  switch (techId) {
    case "python-fastapi":
      return scaffoldPythonService(req);
    case "go":
      return scaffoldGoService(req);
    case "nodejs":
    case "grpc":
      return scaffoldNodeService(req);
    default:
      return scaffoldNodeService(req);
  }
}
