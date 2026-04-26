import type { ClientConcern } from "../types";

export const natsConcern: ClientConcern = {
  targetTechId: "nats",
  envVars: ["NATS_URL"],
  snippet: {
    node: {
      deps: { nats: "^2.28.2" },
      imports: ['import { connect as natsConnect } from "nats";'],
      globals: ["let natsConn;"],
      init: [
        'natsConn = await natsConnect({ servers: process.env.NATS_URL ?? "nats://localhost:4222" });',
      ],
      shutdown: ["if (natsConn) await natsConn.drain();"],
      healthChecks: [
        'natsConn.status === "connected" || (() => { throw new Error("nats not connected"); })();',
      ],
    },
    python: {
      deps: { "nats-py": "2.9.0" },
      imports: ["import os", "import nats"],
      globals: ["_nats_client = None"],
      init: [
        '_nats_client = await nats.connect(os.environ.get("NATS_URL", "nats://localhost:4222"))',
      ],
      shutdown: ["if _nats_client: await _nats_client.drain()"],
      healthChecks: ["_nats_client.is_connected"],
    },
    go: {
      deps: { "github.com/nats-io/nats.go": "v1.37.0" },
      imports: ['"github.com/nats-io/nats.go"'],
      globals: ["var natsConn *nats.Conn"],
      init: [
        "{",
        '\tnc, err := nats.Connect(os.Getenv("NATS_URL"))',
        '\tif err != nil { log.Fatalf("nats: %v", err) }',
        "\tnatsConn = nc",
        "}",
      ],
      shutdown: ["natsConn.Drain()"],
      healthChecks: [
        'func() error { if !natsConn.IsConnected() { return fmt.Errorf("nats disconnected") }; return nil }()',
      ],
    },
  },
};
