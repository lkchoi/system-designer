import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SystemNode from "./SystemNode";
import { __mockReactFlow } from "@xyflow/react";
import { renderWithProviders } from "../test-utils";
import type { SystemNodeData } from "../types";

vi.mock("@xyflow/react");

vi.mock("../registry", () => ({
  registry: {
    getOrDefault: vi.fn(() => ({
      id: "service",
      label: "Service",
      color: "#6366f1",
      icon: "M12 2L2 7l10 5 10-5-10-5z",
      planFields: [],
    })),
    get: vi.fn(),
  },
}));

vi.mock("../hooks/usePricing", () => ({
  usePricing: vi.fn(() => null),
}));

const defaultData: SystemNodeData = {
  label: "auth-service",
  description: "Handles authentication",
  componentType: "service",
  plan: {},
  sharded: false,
  shardKey: "",
  endpoints: [],
  links: [],
  stressFailure: "none",
  capacityPercent: 100,
  consumerRate: 0,
};

function renderSystemNode(
  overrides: Partial<{ data: Partial<SystemNodeData>; selected: boolean }> = {},
  wrapperOptions: Parameters<typeof renderWithProviders>[1] = {},
) {
  const data = { ...defaultData, ...overrides.data };
  const props = {
    id: "node-1",
    type: "system" as const,
    data,
    selected: overrides.selected ?? false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
  return renderWithProviders(<SystemNode {...(props as any)} />, wrapperOptions);
}

describe("SystemNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders node label", () => {
    renderSystemNode();
    expect(screen.getByText("auth-service")).toBeInTheDocument();
  });

  it("renders description", () => {
    renderSystemNode();
    expect(screen.getByText("Handles authentication")).toBeInTheDocument();
  });

  it("enters edit mode on double-click and commits on Enter", async () => {
    const user = userEvent.setup();
    renderSystemNode();

    await user.dblClick(screen.getByText("auth-service"));

    const input = screen.getByDisplayValue("auth-service");
    await user.clear(input);
    await user.type(input, "new-name{Enter}");

    expect(__mockReactFlow.updateNodeData).toHaveBeenCalledWith("node-1", {
      label: "new-name",
    });
  });

  it("cancels edit on Escape without calling updateNodeData", async () => {
    const user = userEvent.setup();
    renderSystemNode();

    await user.dblClick(screen.getByText("auth-service"));
    const input = screen.getByDisplayValue("auth-service");
    await user.clear(input);
    await user.type(input, "changed{Escape}");

    expect(__mockReactFlow.updateNodeData).not.toHaveBeenCalled();
    // Should exit edit mode and show the label again
    expect(screen.getByText("auth-service")).toBeInTheDocument();
  });

  it("calls deleteElements when delete button clicked", async () => {
    const user = userEvent.setup();
    renderSystemNode();

    await user.click(screen.getByTitle("Delete node"));
    expect(__mockReactFlow.deleteElements).toHaveBeenCalledWith({
      nodes: [{ id: "node-1" }],
    });
  });

  it("shows OFFLINE overlay when stressFailure is down in stress mode", () => {
    renderSystemNode(
      { data: { stressFailure: "down" } },
      { mode: "stress" },
    );
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("shows sharded badge when node is sharded", () => {
    renderSystemNode({ data: { sharded: true, shardKey: "user_id" } });
    expect(screen.getByText("user_id")).toBeInTheDocument();
  });

  it("shows stress effect capacity and queue badges", () => {
    const effects = new Map([
      [
        "node-1",
        {
          status: "warning" as const,
          effectiveCapacity: 30,
          queueDepth: 500,
          reason: "backpressure" as const,
        },
      ],
    ]);
    renderSystemNode({}, { mode: "stress", stress: { effects } });
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });
});
