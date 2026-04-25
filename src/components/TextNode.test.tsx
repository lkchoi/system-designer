import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextNode from "./TextNode";
import { __mockReactFlow } from "@xyflow/react";

vi.mock("@xyflow/react");

function renderTextNode(overrides: Record<string, unknown> = {}, selected = false) {
  const props = {
    id: "text-1",
    type: "text" as const,
    data: {
      text: "Hello world",
      size: "medium" as const,
    },
    selected,
    isConnectable: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  };
  return render(<TextNode {...(props as any)} />);
}

describe("TextNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea with text", () => {
    renderTextNode();
    expect(screen.getByPlaceholderText("Heading...")).toHaveValue("Hello world");
  });

  it("shows correct placeholder for each size", () => {
    const { unmount } = renderTextNode({ data: { text: "", size: "large" } });
    expect(screen.getByPlaceholderText("Title...")).toBeInTheDocument();
    unmount();

    renderTextNode({ data: { text: "", size: "medium" } });
    expect(screen.getByPlaceholderText("Heading...")).toBeInTheDocument();
  });

  it("shows correct placeholder for small size", () => {
    renderTextNode({ data: { text: "", size: "small" } });
    expect(screen.getByPlaceholderText("Description...")).toBeInTheDocument();
  });

  it("shows size buttons and delete when selected", () => {
    renderTextNode({}, true);
    expect(screen.getByText("Large")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByTitle("Delete")).toBeInTheDocument();
  });

  it("hides controls when not selected", () => {
    renderTextNode({}, false);
    expect(screen.queryByText("Large")).not.toBeInTheDocument();
    expect(screen.queryByText("Small")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
  });

  it("calls updateNodeData with new size when size button clicked", async () => {
    const user = userEvent.setup();
    renderTextNode({}, true);

    await user.click(screen.getByText("Small"));
    expect(__mockReactFlow.updateNodeData).toHaveBeenCalledWith("text-1", { size: "small" });
  });

  it("calls deleteElements when delete button clicked", async () => {
    const user = userEvent.setup();
    renderTextNode({}, true);

    await user.click(screen.getByTitle("Delete"));
    expect(__mockReactFlow.deleteElements).toHaveBeenCalledWith({
      nodes: [{ id: "text-1" }],
    });
  });
});
