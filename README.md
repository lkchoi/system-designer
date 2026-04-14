# System Designer

An interactive system architecture designer built with React, TypeScript, and [React Flow](https://reactflow.dev). Design distributed systems on a visual canvas, define component configurations, simulate failure scenarios, and analyze cost.

## Features

### Canvas

- Drag-and-drop 18 built-in component types (databases, services, API gateways, caches, message queues, and more) onto an infinite canvas
- Connect components with labeled edges specifying protocol (HTTP, gRPC, WebSocket, etc.) and data format (JSON, Protobuf, etc.)
- Connection validation enforces architectural constraints (e.g., API gateway cannot connect directly to a database)
- Sticky notes and text annotations for documentation
- Resizable nodes, editable edge labels, collapsible sidebar

### Modes

**Plan** — Configure each component's technology, plan fields, sharding, and API gateway endpoints. Technology selection shows throughput, limits, and provider info.

**Stress** — Simulate CAP theorem tradeoffs. Set each node's CAP classification (CP/AP/CA), then click nodes to simulate failures (healthy/overloaded/down) and click edges to simulate network partitions. Cascading effects propagate through the dependency graph automatically.

**Monitor** — Set node status (healthy/warning/error/idle) and view metrics (CPU, memory, requests/sec, latency).

**Price** — Analyze cost based on selected technologies and capacity.

### Flow Paths

Build named sequences of nodes to document request flows (e.g., "Post a comment": Client -> API Gateway -> Comment Service -> Database). Save with name and description, load from the sidebar.

### Extensible Component Registry

All component types are defined in a single registry (`src/registry/`). Each entry includes visual definition, plan fields, technology options, and connection compatibility rules. Adding a new component type requires one entry in `builtin-entries.ts`. The registry supports custom user-defined types via `registry.register()`.

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

- **React 19** + **TypeScript 6**
- **React Flow** (@xyflow/react) for the graph canvas
- **Vite 8** for dev server and build
- **ULID** for unique IDs

## Project Structure

```
src/
  App.tsx              Main canvas, mode system, state management
  stressEngine.ts      Pure function computing cascading failure effects
  types.ts             Shared TypeScript interfaces
  data.ts              Utility functions (randomMetrics, displayType)
  registry/
    builtin-entries.ts   18 component type definitions
    ComponentRegistry.ts Registry class (get, canConnect, register)
    pricing.ts           Technology pricing data
    types.ts             Registry interfaces
  components/
    SystemNode.tsx       System component node
    PropertiesPanel.tsx  Node properties (mode-aware)
    EdgePropertiesPanel.tsx  Edge properties
    LabeledEdge.tsx      Custom edge with labels and tags
    Sidebar.tsx          Draggable component palette + saved paths
    StickyNote.tsx       Sticky note annotations
    TextNode.tsx         Text labels
  hooks/
    useHotkeys.ts        Keyboard shortcut system
```
