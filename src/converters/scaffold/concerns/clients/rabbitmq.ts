import type { ClientConcern } from "../types";

export const rabbitmqConcern: ClientConcern = {
  targetTechId: "rabbitmq",
  envVars: ["RABBITMQ_URL"],
  snippet: {
    node: {
      deps: { amqplib: "^0.10.5" },
      imports: ['import amqp from "amqplib";'],
      globals: ["let amqpConn;"],
      init: [
        'amqpConn = await amqp.connect(process.env.RABBITMQ_URL ?? "amqp://localhost");',
      ],
      shutdown: ["if (amqpConn) await amqpConn.close();"],
      healthChecks: [
        'const ch = await amqpConn.createChannel(); await ch.close();',
      ],
    },
    python: {
      deps: { pika: "1.3.2" },
      imports: ["import os", "import pika"],
      globals: [
        '_amqp_conn = pika.BlockingConnection(pika.URLParameters(os.environ.get("RABBITMQ_URL", "amqp://localhost")))',
      ],
      init: [],
      shutdown: ["_amqp_conn.close()"],
      healthChecks: ["_amqp_conn.is_open"],
    },
    go: {
      deps: { "github.com/rabbitmq/amqp091-go": "v1.10.0" },
      imports: ["amqp \"github.com/rabbitmq/amqp091-go\""],
      globals: ["var amqpConn *amqp.Connection"],
      init: [
        "{",
        '\tconn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))',
        '\tif err != nil { log.Fatalf("rabbitmq: %v", err) }',
        "\tamqpConn = conn",
        "}",
      ],
      shutdown: ["amqpConn.Close()"],
      healthChecks: ["func() error { if amqpConn.IsClosed() { return fmt.Errorf(\"closed\") }; return nil }()"],
    },
  },
};
