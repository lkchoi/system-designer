# Export Formats

Export designs via `Cmd+E`. 11 export formats in three categories.

## Diagram formats

### Native JSON

Full-fidelity serialization of the design — nodes, edges, positions, all plan data. Use this for saving, sharing, and version-controlling designs.

- **Import:** Yes (`Cmd+I`)
- **File:** `<design-name>.json`

### Excalidraw

Converts the design to an Excalidraw-compatible JSON file. Nodes become labeled rectangles, edges become arrows. Useful for embedding designs in documentation or collaborating in Excalidraw.

- **Import:** Yes
- **File:** `<design-name>.excalidraw.json`
- **Note:** Imports Excalidraw files back into system designs by mapping shapes to component types.

## Infrastructure as Code

All IaC formats use `src/converters/iac-mapping.ts` to map (componentType, technologyId) pairs to provider-specific resources. Node descriptions are preserved as comments or annotations.

### AWS CloudFormation

Generates a CloudFormation template with one resource per node. Resource types are mapped from technologies (e.g., PostgreSQL -> `AWS::RDS::DBInstance`, Redis -> `AWS::ElastiCache::CacheCluster`).

- **Import:** Yes (parses existing templates back into designs)
- **File:** `<design-name>.cfn.yaml`
- **Generates:** Resource definitions with basic properties. Does not generate VPC, subnets, security groups, or IAM roles.

### Terraform

Generates a `.tf.json` file with `resource` blocks. Technologies are mapped to Terraform resource types (e.g., PostgreSQL -> `aws_db_instance`, S3 -> `aws_s3_bucket`).

- **Import:** Yes (parses `.tf.json` back into designs)
- **File:** `<design-name>.tf.json`
- **Generates:** Resource blocks with basic attributes. Does not generate providers, state backends, or networking.

### Kubernetes

Generates Kubernetes manifests (YAML) with one resource per node. Services become Deployments, databases become StatefulSets, and networking components become Ingresses.

- **Import:** Yes
- **File:** `<design-name>.k8s.yaml`
- **Generates:** Deployment/StatefulSet specs with container images and ports. Does not generate Namespaces, NetworkPolicies, or PersistentVolumeClaims.

### AWS CDK

Generates a TypeScript CDK application. Each node becomes a CDK construct (e.g., `rds.DatabaseInstance`, `s3.Bucket`).

- **Import:** No
- **File:** `<design-name>.cdk.ts`
- **Generates:** Construct instantiations with basic properties. Does not generate a complete CDK app (`cdk.json`, `bin/`, etc.).

### Pulumi

Generates a TypeScript Pulumi program. Each node becomes a Pulumi resource.

- **Import:** No
- **File:** `<design-name>.pulumi.ts`
- **Generates:** Resource declarations with basic properties.

### Docker Compose (Local-Deploy Bundle)

The richest export. Generates a complete local-deploy bundle as a zip file:

```
local-stack/
  docker-compose.yaml     # All services with images, ports, volumes, env vars
  .env                    # Generated secrets (database passwords, API keys)
  README.md               # Service URLs, credentials, architecture notes
  start.sh                # Health-checked startup script
  stop.sh                 # Graceful shutdown
  reset.sh                # Full reset (removes volumes)
  test.sh                 # Runs scaffolded service test suites
  init/                   # Schema SQL, topic creation scripts, bucket init
  services/               # Scaffolded application code (if applicable)
  CLAUDE.md               # AI-assistant context (optional)
```

**Service scaffolding:** Service and Serverless nodes without a pre-built image get a scaffolded hello-world server in Go, Node.js, or Python (based on the selected technology). The scaffold includes:

- Dockerfile and dependency files (`go.mod`, `package.json`, `requirements.txt`)
- HTTP server with health endpoint and declared API endpoint stubs
- Client SDK initialization for connected dependencies (Redis, PostgreSQL, Kafka, etc.)
- Health checks that ping all connected services
- Graceful shutdown handlers
- Unit tests

**Auto-wiring:** Edges between nodes generate environment variables (`DATABASE_URL`, `REDIS_URL`, `KAFKA_BOOTSTRAP_SERVERS`), `depends_on` relationships, and init scripts (schema SQL, topic creation, bucket initialization).

**Excluded components:** API Gateway, Load Balancer, CDN, DNS, Firewall, and Client nodes are documented in the README but not deployed (they represent production-only infrastructure). Vendor-locked serverless (AWS Lambda, Cloud Functions) is also excluded with a note.

- **Import:** No
- **File:** `local-stack.zip`

### Nomad

Generates a HashiCorp Nomad job specification in JSON format.

- **Import:** No
- **File:** `<design-name>.nomad.json`

### LocalStack

Generates a Docker Compose setup that uses LocalStack to emulate AWS services locally, combined with a CloudFormation template applied via `awslocal`.

- **Import:** No
- **File:** `<design-name>.localstack.zip`

## API formats

### OpenAPI 3.0

Generates an OpenAPI 3.0 specification from API Gateway nodes. Endpoints defined on the node become path operations in the spec, including query parameters and response codes.

- **Import:** No
- **File:** `<design-name>.openapi.yaml`
- **Note:** Only API Gateway nodes with defined endpoints produce output.

## Import

5 formats support import (`Cmd+I`): Native JSON, Excalidraw, CloudFormation, Terraform, and Kubernetes. The importer auto-detects the format from the file contents.

Import performs reverse mapping: CloudFormation resource types are mapped back to component types and technologies (e.g., `AWS::RDS::DBInstance` -> Database with PostgreSQL). Spatial layout is reconstructed from the node order.
