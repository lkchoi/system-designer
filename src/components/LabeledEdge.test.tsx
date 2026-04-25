import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabeledEdge from "./LabeledEdge";
import { renderWithProviders } from "../test-utils";

vi.mock("@xyflow/react");

const baseProps = {
  id: "edge-1",
  source: "a",
  target: "b",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: "right" as const,
  targetPosition: "left" as const,
  selected: false,
  data: undefined as Record<string, unknown> | undefined,
};

describe("LabeledEdge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label text", () => {
    renderWithProviders(
      <LabeledEdge {...(baseProps as any)} data={{ label: "auth" }} />,
    );
    expect(screen.getByText("auth")).toBeInTheDocument();
  });

  it("renders protocol and format tags", () => {
    renderWithProviders(
      <LabeledEdge
        {...(baseProps as any)}
        data={{ protocol: "gRPC", format: "Protobuf" }}
      />,
    );
    expect(screen.getByText("gRPC")).toBeInTheDocument();
    expect(screen.getByText("Protobuf")).toBeInTheDocument();
  });

  it("shows hint when selected with no label or tags", () => {
    renderWithProviders(
      <LabeledEdge {...(baseProps as any)} selected data={{}} />,
    );
    expect(screen.getByText("double-click to label")).toBeInTheDocument();
  });

  it("does not show hint when there are tags", () => {
    renderWithProviders(
      <LabeledEdge
        {...(baseProps as any)}
        selected
        data={{ protocol: "HTTP" }}
      />,
    );
    expect(screen.queryByText("double-click to label")).not.toBeInTheDocument();
  });

  it("shows SPLIT badge in stress mode when partitioned", () => {
    renderWithProviders(
      <LabeledEdge {...(baseProps as any)} data={{}} />,
      { mode: "stress", stress: { partitionedEdges: new Set(["edge-1"]) } },
    );
    expect(screen.getByText("SPLIT")).toBeInTheDocument();
  });

  it("shows SLOW badge in stress mode", () => {
    renderWithProviders(
      <LabeledEdge
        {...(baseProps as any)}
        data={{ simulatedLatency: 800 }}
      />,
      {
        mode: "stress",
        stress: {
          slowEdges: new Set(["edge-1"]),
          stressConfig: { trafficMultiplier: 1, latencyThreshold: 500 },
        },
      },
    );
    expect(screen.getByText("SLOW 800ms")).toBeInTheDocument();
  });

  it("shows TIMEOUT badge when latency exceeds 3x threshold", () => {
    renderWithProviders(
      <LabeledEdge
        {...(baseProps as any)}
        data={{ simulatedLatency: 2000 }}
      />,
      {
        mode: "stress",
        stress: {
          slowEdges: new Set(["edge-1"]),
          stressConfig: { trafficMultiplier: 1, latencyThreshold: 500 },
        },
      },
    );
    expect(screen.getByText("TIMEOUT 2000ms")).toBeInTheDocument();
  });

  it("enters edit mode on double-click and commits on Enter", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    window.addEventListener("edge-label-change", spy);

    renderWithProviders(
      <LabeledEdge
        {...(baseProps as any)}
        selected
        data={{ label: "old" }}
      />,
    );

    await user.dblClick(screen.getByText("old"));

    const input = screen.getByDisplayValue("old");
    await user.clear(input);
    await user.type(input, "new-label{Enter}");

    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ id: "edge-1", label: "new-label" });

    window.removeEventListener("edge-label-change", spy);
  });
});
