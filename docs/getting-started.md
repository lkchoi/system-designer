# Getting Started

Arkon is a browser-based tool for designing distributed system architectures. No installation, no backend, no account required — open the app and start building.

## Your first design

### 1. Add components

Drag components from the left sidebar onto the canvas. Start with a simple stack:

1. **Client** — the user's browser or mobile app
2. **Load Balancer** — distributes traffic
3. **Service** — your application server
4. **Database** — persistent storage

### 2. Connect them

Click a component's output handle (right edge) and drag to another component's input handle (left edge). Connections are validated — the tool enforces architectural constraints (e.g., a client can't connect directly to a database).

When you draw a connection, the edge defaults are auto-filled based on the component pair: protocol, format, and label.

### 3. Configure technologies

Switch to **Plan mode** (press `1` or click the mode selector). Click any component to open the properties panel. Select a technology — for example, PostgreSQL for your database, or Go for your service. Fill in plan fields like table names, endpoints, or replica counts.

### 4. Export

Press `Cmd+E` to open the export dialog. Choose a format:

- **Docker Compose** — generates a runnable local-deploy bundle with `docker-compose.yaml`, scaffolded service code, init scripts, and a README
- **Terraform** — generates `.tf.json` resource definitions
- **CloudFormation** — generates an AWS CloudFormation template
- **Native JSON** — the design itself, for saving/sharing

### 5. Run it locally

If you exported Docker Compose:

```bash
unzip local-stack.zip && cd local-stack
chmod +x *.sh
./start.sh
```

The generated `README.md` inside the bundle lists all service URLs and credentials.

## Key concepts

### Modes

The mode selector in the toolbar switches the properties panel's behavior:

| Mode    | Key | Purpose                                        |
| ------- | --- | ---------------------------------------------- |
| Plan    | `1` | Configure technologies, endpoints, plan fields |
| Stress  | `2` | Simulate failures and CAP theorem tradeoffs    |
| Monitor | `3` | Set node status, view health metrics           |
| Price   | `4` | Analyze cost based on selected technologies    |

### Patterns

The sidebar's **Patterns** tab contains 12 pre-wired architectural patterns (Cache-Aside, CQRS, Pub/Sub Fanout, etc.). Drag a pattern onto the canvas to place an entire subgraph — all nodes and edges are pre-connected.

### Tools

The properties panel shows context-aware tools based on the selected component type. For example, selecting a database node offers the Capacity Calculator and Connection Pool Sizer. Press `C` to open the Capacity Calculator from anywhere.

### Persistence

Designs are saved automatically to your browser's local storage (SQLite via OPFS). Use the design picker in the top bar to create, switch between, and manage multiple designs. No data leaves your browser.

## Keyboard shortcuts

Press `?` to see all shortcuts. Key bindings:

| Shortcut        | Action              |
| --------------- | ------------------- |
| `1` `2` `3` `4` | Switch modes        |
| `Cmd+E`         | Export              |
| `Cmd+I`         | Import              |
| `Cmd+Z`         | Undo                |
| `Cmd+Shift+Z`   | Redo                |
| `S`             | Add sticky note     |
| `T`             | Add text node       |
| `F`             | Toggle flow path    |
| `B`             | Toggle sidebar      |
| `C`             | Capacity Calculator |
| `R`             | Cron Translator     |
| `/`             | Filter sidebar      |
| `?`             | Show all shortcuts  |
