import yaml from "js-yaml";
import type { ConverterModule } from "./types";
import type { DesignJSON } from "../db/io";
import { cloudformationConverter } from "./cloudformation";

function exportToLocalStack(design: DesignJSON): string {
  // Generate CloudFormation template
  const cfnResult = cloudformationConverter.exportDesign(design);
  const cfnContent =
    typeof cfnResult.content === "string" ? cfnResult.content : "<binary cfn output>";

  // Generate docker-compose for LocalStack
  const compose = {
    services: {
      localstack: {
        image: "localstack/localstack:latest",
        ports: ["4566:4566", "4510-4559:4510-4559"],
        environment: {
          SERVICES:
            "s3,sqs,dynamodb,lambda,apigateway,sns,kinesis,rds,elasticache,route53,cloudformation,events",
          DEBUG: "0",
          DOCKER_HOST: "unix:///var/run/docker.sock",
        },
        volumes: [
          "/var/run/docker.sock:/var/run/docker.sock",
          "./init:/etc/localstack/init/ready.d",
        ],
      },
    },
  };

  const composeYaml = yaml.dump(compose, { lineWidth: 120, noRefs: true });

  // Generate init script
  const initScript = `#!/bin/bash
# Deploy CloudFormation template to LocalStack
awslocal cloudformation create-stack \\
  --stack-name ${design.name.replace(/[^a-zA-Z0-9-]/g, "-")} \\
  --template-body file:///etc/localstack/init/ready.d/template.yaml

echo "Stack deployment initiated"
`;

  // Combine all files into a single output with markers
  return `# ============================================================
# LocalStack Development Environment
# Generated from: ${design.name}
# ============================================================
#
# Files:
#   docker-compose.yaml  - LocalStack container
#   init/template.yaml   - CloudFormation template
#   init/deploy.sh       - Auto-deploy script
#
# Usage:
#   docker compose up -d
#   (template auto-deploys via init script)
#
# ============================================================

# --- docker-compose.yaml ---
${composeYaml}
# --- init/template.yaml ---
${cfnContent}
# --- init/deploy.sh ---
${initScript}`;
}

export const localstackConverter: ConverterModule = {
  id: "localstack",
  label: "LocalStack",
  description: "Local AWS emulation setup",
  category: "iac",
  fileExtensions: [".yaml"],
  canImport: false,

  exportDesign(design: DesignJSON) {
    return {
      content: exportToLocalStack(design),
      filename: `${design.name}-localstack.yaml`,
      mimeType: "text/yaml",
    };
  },
};
