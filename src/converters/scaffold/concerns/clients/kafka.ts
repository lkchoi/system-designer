import type { ClientConcern } from "../types";

export const kafkaConcern: ClientConcern = {
  targetTechId: "kafka",
  envVars: ["KAFKA_BOOTSTRAP_SERVERS"],
  snippet: {
    node: {
      deps: { kafkajs: "^2.2.4" },
      imports: ['import { Kafka } from "kafkajs";'],
      globals: [
        'const kafka = new Kafka({ brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:9092").split(",") });',
      ],
      init: [],
      shutdown: [],
      healthChecks: [
        "const admin = kafka.admin(); await admin.connect(); await admin.disconnect();",
      ],
    },
    python: {
      deps: { "confluent-kafka": "2.6.1" },
      imports: ["import os", "from confluent_kafka import Producer"],
      globals: [
        '_kafka_producer = Producer({"bootstrap.servers": os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")})',
      ],
      init: [],
      shutdown: ["_kafka_producer.flush(5)"],
      healthChecks: ["_kafka_producer.list_topics(timeout=5)"],
    },
    go: {
      deps: { "github.com/segmentio/kafka-go": "v0.4.47" },
      imports: ['"context"', '"github.com/segmentio/kafka-go"'],
      globals: ["var kafkaConn *kafka.Conn"],
      init: [
        "{",
        '\tconn, err := kafka.DialContext(context.Background(), "tcp", os.Getenv("KAFKA_BOOTSTRAP_SERVERS"))',
        '\tif err != nil { log.Fatalf("kafka: %v", err) }',
        "\tkafkaConn = conn",
        "}",
      ],
      shutdown: ["kafkaConn.Close()"],
      healthChecks: ["kafkaConn.Brokers()"],
    },
  },
};
