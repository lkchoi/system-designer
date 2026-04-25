import type { ClientConcern } from "../types";

export const s3Concern: ClientConcern = {
  targetTechId: "s3",
  envVars: ["S3_BUCKET", "AWS_REGION", "S3_ENDPOINT"],
  snippet: {
    node: {
      deps: { "@aws-sdk/client-s3": "^3.700.0" },
      imports: ['import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";'],
      globals: [
        "const s3 = new S3Client({ ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) });",
      ],
      init: [],
      shutdown: [],
      healthChecks: [
        'await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, MaxKeys: 1 }));',
      ],
    },
    python: {
      deps: { boto3: "1.35.74" },
      imports: ["import os", "import boto3"],
      globals: [
        '_s3 = boto3.client("s3", **({\"endpoint_url\": os.environ[\"S3_ENDPOINT\"]} if os.environ.get(\"S3_ENDPOINT\") else {}))',
      ],
      init: [],
      shutdown: [],
      healthChecks: [
        '_s3.list_objects_v2(Bucket=os.environ.get("S3_BUCKET", "default"), MaxKeys=1)',
      ],
    },
    go: {
      deps: {
        "github.com/aws/aws-sdk-go-v2/config": "v1.28.7",
        "github.com/aws/aws-sdk-go-v2/service/s3": "v1.71.1",
      },
      imports: [
        '"context"',
        '"github.com/aws/aws-sdk-go-v2/config"',
        '"github.com/aws/aws-sdk-go-v2/service/s3"',
      ],
      globals: ["var s3Client *s3.Client"],
      init: [
        "cfg, err := config.LoadDefaultConfig(context.Background())",
        'if err != nil { log.Fatalf("aws config: %v", err) }',
        "s3Client = s3.NewFromConfig(cfg)",
      ],
      shutdown: [],
      healthChecks: [
        'func() error { bucket := os.Getenv("S3_BUCKET"); _, err := s3Client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{Bucket: &bucket, MaxKeys: aws.Int32(1)}); return err }()',
      ],
    },
  },
};
