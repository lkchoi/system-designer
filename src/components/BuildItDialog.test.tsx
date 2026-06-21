import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BuildItDialog from "./BuildItDialog";
import type { Edge, Node } from "@xyflow/react";
import type { SystemNodeData } from "../types";

function svcNode(id: string, label: string): Node<SystemNodeData> {
  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label,
      description: "",
      componentType: "service",
      plan: { technology: "nodejs" },
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
  };
}

function dbNode(id: string, label: string): Node<SystemNodeData> {
  return {
    id,
    type: "system",
    position: { x: 0, y: 0 },
    data: {
      label,
      description: "",
      componentType: "database",
      plan: { technology: "postgresql", tables: "users" },
      sharded: false,
      shardKey: "",
      endpoints: [],
      links: [],
      stressFailure: "none",
      capacityPercent: 0,
      consumerRate: 0,
    },
  };
}

describe("BuildItDialog", () => {
  const nodes: Node[] = [svcNode("s1", "Orders Svc"), dbNode("d1", "Orders DB")];
  const edges: Edge[] = [];

  const baseProps = {
    open: true,
    onClose: vi.fn(),
    nodes,
    edges,
    designName: "Test",
    selectedNodeId: null,
  };

  it("renders nothing when closed", () => {
    const { container } = render(<BuildItDialog {...baseProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders heading and scope buttons when open", () => {
    render(<BuildItDialog {...baseProps} />);
    expect(screen.getByText("Build it")).toBeInTheDocument();
    expect(screen.getByText("All nodes")).toBeInTheDocument();
    expect(screen.getByText("Selected only")).toBeInTheDocument();
    // Node count reflected.
    expect(screen.getByText(/2 on canvas/)).toBeInTheDocument();
  });

  it("disables 'Selected only' when no node is selected", () => {
    render(<BuildItDialog {...baseProps} />);
    const btn = screen.getByText("Selected only").closest("button")!;
    expect(btn).toBeDisabled();
    expect(screen.getByText(/select a node first/)).toBeInTheDocument();
  });

  it("enables 'Selected only' and shows '1 selected' when a node is selected", () => {
    render(<BuildItDialog {...baseProps} selectedNodeId="s1" />);
    const btn = screen.getByText("Selected only").closest("button")!;
    expect(btn).not.toBeDisabled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("Build runs the generator and shows a result summary + file list", async () => {
    const user = userEvent.setup();
    render(<BuildItDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    // Bundle count = 1 (Orders Svc → prompt.md), file count = 1 (Orders DB → schema.sql).
    await waitFor(() => {
      expect(screen.getByText("bundles")).toBeInTheDocument();
    });
    expect(screen.getByText("files")).toBeInTheDocument();
    // Folder names appear in the file tree.
    expect(screen.getByText("orders-svc/")).toBeInTheDocument();
    expect(screen.getByText("orders-db/")).toBeInTheDocument();
    // Specific files listed. (prompt.md appears in the description prose too,
    // so use getAllByText.)
    expect(screen.getByText("schema.sql")).toBeInTheDocument();
    expect(screen.getAllByText("prompt.md").length).toBeGreaterThan(0);
  });

  it("offers a Download .zip button after a successful build", async () => {
    const user = userEvent.setup();
    render(<BuildItDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Download \.zip/i })).toBeInTheDocument();
    });
  });

  it("scoping to 'Selected only' limits output to the selected node's folder", async () => {
    const user = userEvent.setup();
    render(<BuildItDialog {...baseProps} selectedNodeId="d1" />);
    await user.click(screen.getByText("Selected only"));
    await user.click(screen.getByRole("button", { name: "Build" }));
    await waitFor(() => {
      expect(screen.getByText("orders-db/")).toBeInTheDocument();
    });
    expect(screen.queryByText("orders-svc/")).not.toBeInTheDocument();
  });

  it("Rebuild button resets to the scope selection screen", async () => {
    const user = userEvent.setup();
    render(<BuildItDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Build" }));
    await waitFor(() => screen.getByText("bundles"));
    await user.click(screen.getByText(/Rebuild/));
    // Build button visible again (means we're back in the pre-build state).
    expect(screen.getByRole("button", { name: "Build" })).toBeInTheDocument();
  });
});
