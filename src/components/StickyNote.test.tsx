import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StickyNote from "./StickyNote";
import { __mockReactFlow } from "@xyflow/react";
import { STICKY_COLORS } from "../types";

vi.mock("@xyflow/react");

function renderStickyNote(overrides: Record<string, unknown> = {}, selected = false) {
  const props = {
    id: "sticky-1",
    type: "sticky" as const,
    data: {
      text: "Test note",
      color: "#fde68a" as const,
    },
    selected,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  };
  return render(<StickyNote {...(props as any)} />);
}

describe("StickyNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea with initial text", () => {
    renderStickyNote();
    expect(screen.getByPlaceholderText("Type a note...")).toHaveValue("Test note");
  });

  it("renders with background color", () => {
    const { container } = renderStickyNote();
    const noteDiv = container.querySelector('[style*="background"]');
    expect(noteDiv).toHaveStyle({ background: "#fde68a" });
  });

  it("calls updateNodeData when typing", async () => {
    const user = userEvent.setup();
    renderStickyNote();

    const textarea = screen.getByPlaceholderText("Type a note...");
    await user.clear(textarea);
    await user.type(textarea, "Updated");

    expect(__mockReactFlow.updateNodeData).toHaveBeenCalled();
    const lastCall = __mockReactFlow.updateNodeData.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe("sticky-1");
    expect(lastCall[1]).toHaveProperty("text");
  });

  it("shows color swatches and delete when selected", () => {
    const { container } = renderStickyNote({}, true);
    const buttons = container.querySelectorAll("button");
    // 5 color swatches + 1 delete button
    expect(buttons.length).toBe(STICKY_COLORS.length + 1);
  });

  it("hides controls when not selected", () => {
    const { container } = renderStickyNote({}, false);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });

  it("calls updateNodeData with new color when swatch clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderStickyNote({}, true);

    // Click the second color swatch (green: #bbf7d0)
    const swatches = container.querySelectorAll("button");
    await user.click(swatches[1]);

    expect(__mockReactFlow.updateNodeData).toHaveBeenCalledWith("sticky-1", {
      color: STICKY_COLORS[1],
    });
  });

  it("calls deleteElements when delete button clicked", async () => {
    const user = userEvent.setup();
    renderStickyNote({}, true);

    const deleteBtn = screen.getByTitle("Delete note");
    await user.click(deleteBtn);

    expect(__mockReactFlow.deleteElements).toHaveBeenCalledWith({
      nodes: [{ id: "sticky-1" }],
    });
  });
});
