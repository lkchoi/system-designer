import type { ClientConcern } from "../types";

export const elasticsearchConcern: ClientConcern = {
  targetTechId: "elasticsearch",
  envVars: ["ES_URL"],
  snippet: {
    node: {
      deps: { "@elastic/elasticsearch": "^8.17.0" },
      imports: ['import { Client as ESClient } from "@elastic/elasticsearch";'],
      globals: [
        'const esClient = new ESClient({ node: process.env.ES_URL ?? "http://localhost:9200" });',
      ],
      init: [],
      shutdown: ["await esClient.close();"],
      healthChecks: ["await esClient.ping();"],
    },
    python: {
      deps: { elasticsearch: "8.17.0" },
      imports: ["import os", "from elasticsearch import Elasticsearch"],
      globals: [
        '_es = Elasticsearch(os.environ.get("ES_URL", "http://localhost:9200"))',
      ],
      init: [],
      shutdown: ["_es.close()"],
      healthChecks: ["_es.ping()"],
    },
    go: {
      deps: { "github.com/elastic/go-elasticsearch/v8": "v8.17.0" },
      imports: ['"github.com/elastic/go-elasticsearch/v8"'],
      globals: ["var esClient *elasticsearch.Client"],
      init: [
        "{",
        "\tes, err := elasticsearch.NewClient(elasticsearch.Config{Addresses: []string{os.Getenv(\"ES_URL\")}})",
        '\tif err != nil { log.Fatalf("elasticsearch: %v", err) }',
        "\tesClient = es",
        "}",
      ],
      shutdown: [],
      healthChecks: [
        'func() error { _, err := esClient.Ping(); return err }()',
      ],
    },
  },
};
