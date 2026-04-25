# Extending System Designer

Four extension points, each following the same pattern: add one entry to a registry, no other files need to change.

## Add a component type

**File:** `src/registry/builtin-entries.ts`

Add one entry to the `BUILTIN_ENTRIES` array:

```typescript
{
  id: "my-component",              // unique ID, used as ComponentType
  label: "My Component",           // display name
  color: "#6366f1",                // hex color for the node
  icon: "M4 7v10c0 2.2 ...",      // SVG path data (24x24 viewBox)
  category: "compute",             // compute | data | networking | messaging | scheduling | storage | client
  source: "builtin",
  planFields: [
    { key: "technology", label: "Technology", type: "technology" },
    { key: "replicas", label: "Replicas", placeholder: "3" },
    // ... more fields
  ],
  technologies: TECHNOLOGY_CATALOG["my-component"],  // or inline array
  connectsTo: ["database", "cache", "message-queue"],
}
```

That's it. The component appears in the sidebar, works on the canvas, shows plan fields in Plan mode, and validates connections.

**If your component needs technologies**, add an entry to `TECHNOLOGY_CATALOG` in `src/technologies.ts`:

```typescript
"my-component": [
  { id: "tech-a", name: "Tech A", throughput: "10k rps", limits: "...", purpose: "...", providers: ["AWS"], vendor: "aws" },
]
```

## Add a technology to an existing component

**File:** `src/technologies.ts` — add to the relevant `TECHNOLOGY_CATALOG` array.

**Optionally:** `src/converters/iac-mapping.ts` — add a `MappingEntry` so IaC exports know what resource to generate:

```typescript
{
  componentType: "database",
  technologyId: "my-new-db",
  mapping: {
    cfn: "AWS::RDS::DBInstance",
    terraform: "aws_db_instance",
    docker: "my-db:latest",
    defaultPorts: [5432],
  },
}
```

**Optionally:** `src/connections/tech-rules.ts` — add a `TechConnectionRule` for IaC metadata, env var templates, or blocked pairs:

```typescript
{
  sourceTech: "*",
  targetTech: "my-new-db",
  port: 5432,
  envVars: { DATABASE_URL: "postgres://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}" },
  iac: { iamActions: ["rds-db:connect"], securityGroupPorts: [{ port: 5432, protocol: "tcp" }] },
}
```

## Add an export format

**File:** Create `src/converters/my-format.ts` implementing `ConverterModule`:

```typescript
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";

export const myFormatConverter: ConverterModule = {
  id: "my-format",
  label: "My Format",
  description: "Description shown in export dialog",
  category: "iac",                    // "diagram" | "iac" | "api"
  fileExtensions: [".yaml"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    // Transform design.nodes and design.edges into your format.
    // Each node has: id, type ("system"), data (SystemNodeData), position.
    // Each edge has: id, source, target, data (EdgeData).
    const output = "...";
    return {
      content: output,
      filename: `${design.name}.my-format.yaml`,
      mimeType: "text/yaml",
    };
  },
};
```

**Register it** in `src/converters/index.ts`:

```typescript
import { myFormatConverter } from "./my-format";
// Add to CONVERTERS array:
const CONVERTERS: ConverterModule[] = [
  // ... existing converters
  myFormatConverter,
];
```

The format immediately appears in the export dialog. If `canImport: true`, also implement `importDesign(content: string): DesignJSON` and the format appears in the import dialog.

**Reference:** `src/converters/nomad.ts` is the simplest converter (~100 lines). Read it as a template.

## Add a client concern (scaffold code generation)

**File:** Create `src/converters/scaffold/concerns/clients/my-tech.ts`:

```typescript
import type { ClientConcern } from "../types";

export const myTechConcern: ClientConcern = {
  targetTechId: "my-tech",           // must match the technology ID in iac-mapping.ts
  envVars: ["MY_TECH_URL"],          // env vars this concern reads (from wiring.ts)
  snippet: {
    node: {
      deps: { "my-tech-client": "^2.0.0" },
      imports: ['import { Client } from "my-tech-client";'],
      globals: ['const myTech = new Client(process.env.MY_TECH_URL);'],
      init: [],
      shutdown: ['await myTech.close();'],
      healthChecks: ['await myTech.ping();'],
    },
    python: {
      deps: { "my-tech-client": "2.0.0" },
      imports: ['import os', 'import my_tech_client'],
      globals: ['_my_tech = my_tech_client.connect(os.environ["MY_TECH_URL"])'],
      init: [],
      shutdown: ['_my_tech.close()'],
      healthChecks: ['_my_tech.ping()'],
    },
    go: {
      deps: { "github.com/example/my-tech-go": "v2.0.0" },
      imports: ['"github.com/example/my-tech-go"'],
      globals: ['var myTechClient *mytech.Client'],
      init: [
        'client, err := mytech.Connect(os.Getenv("MY_TECH_URL"))',
        'if err != nil { log.Fatalf("my-tech: %v", err) }',
        'myTechClient = client',
      ],
      shutdown: ['myTechClient.Close()'],
      healthChecks: ['myTechClient.Ping(context.Background())'],
    },
  },
};
```

**Register it** in `src/converters/scaffold/concerns/clients/index.ts`:

```typescript
import { myTechConcern } from "./my-tech";
// Add to CLIENT_CONCERNS array and it will be auto-indexed by targetTechId.
```

When a scaffolded service has an outgoing edge to a node with `technology: "my-tech"`, the generated code will include the SDK dependency, import, client initialization, health check, and shutdown handler.

**Slot reference:**

| Slot | Where it renders (Go) | Where it renders (Node.js) | Where it renders (Python) |
|------|----------------------|--------------------------|--------------------------|
| `deps` | `go.mod` require block | `package.json` dependencies | `requirements.txt` |
| `imports` | `import (...)` block | Top of `index.js` | Top of `main.py` |
| `globals` | After import, before `newMux()` | After imports | After `app = FastAPI(...)` |
| `init` | Inside `main()`, before `ListenAndServe` | Inside `if (import.meta.url ...)` guard | `@app.on_event("startup")` handler |
| `shutdown` | `go func()` with signal handler | `process.on("SIGTERM", ...)` | `@app.on_event("shutdown")` handler |
| `healthChecks` | Inside `/health` handler, returns 503 on error | Inside `/health` handler, try/catch | Inside `/health` handler, try/except |

## Add a tool

**File:** Create `src/tools/my-tool/MyTool.tsx` (React component) and optionally `my-tool.ts` (logic) and `my-tool.test.ts` (tests).

**Register it** in `src/tools/index.ts`:

```typescript
{
  id: "my-tool",
  label: "My Tool",
  appliesTo: ["database", "cache"],  // component types that show this tool
  component: lazy(() => import("./my-tool/MyTool")),
}
```

The tool appears in the properties panel when a matching component type is selected.

## Add a pattern

**File:** `src/patterns/builtin-patterns.ts` — add to the `BUILTIN_PATTERNS` array:

```typescript
{
  id: "my-pattern",
  name: "My Pattern",
  description: "Short description shown in sidebar",
  icon: "M4 4h16v4H4z...",          // SVG path data
  color: "#6366f1",
  source: "builtin",
  nodes: [
    { localId: "svc", componentType: "service", relativePosition: { x: 0, y: 0 } },
    { localId: "db", componentType: "database", relativePosition: { x: 280, y: 0 } },
  ],
  edges: [
    { sourceLocalId: "svc", targetLocalId: "db", label: "queries" },
  ],
}
```

The pattern immediately appears in the sidebar's Patterns tab and can be dragged onto the canvas.
