import type { RuntimeConcern } from "../types";

/**
 * AWS Lambda runtime concern. Adds the Lambda handler deps/imports.
 * The language template checks runtime.id === "lambda" to switch
 * the entrypoint shape (lambda.Start vs http.ListenAndServe, etc.).
 */
export const lambdaRuntime: RuntimeConcern = {
  id: "lambda",
  appliesTo: ["go", "node", "python"],
  snippet: {
    go: {
      deps: { "github.com/aws/aws-lambda-go": "v1.47.0" },
      imports: ['"github.com/aws/aws-lambda-go/lambda"', '"github.com/aws/aws-lambda-go/events"'],
      globals: [],
      init: [],
      shutdown: [],
      healthChecks: [],
    },
    node: {
      deps: {},
      imports: [],
      globals: [],
      init: [],
      shutdown: [],
      healthChecks: [],
    },
    python: {
      deps: {},
      imports: [],
      globals: [],
      init: [],
      shutdown: [],
      healthChecks: [],
    },
  },
};
