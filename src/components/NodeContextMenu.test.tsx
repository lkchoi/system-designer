import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NodeContextMenu from "./NodeContextMenu";
import type { Node } from "@xyflow/react";

const node: Node = {
  id: "n1",
  type: "system",
  position: { x: 0, y: 0 },
  data: { label: "Orders Service" },
};

describe("NodeContextMenu", () => {
  it("renders the node label as the menu header", () => {
    render(
      <NodeContextMenu node={node} position={{ x: 100, y: 200 }} onBuildIt={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText("Orders Service")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Build it/i })).toBeInTheDocument();
  });

  it("falls back to id when label is missing", () => {
    const bare: Node = { id: "bare-id", type: "x", position: { x: 0, y: 0 }, data: {} };
    render(
      <NodeContextMenu node={bare} position={{ x: 0, y: 0 }} onBuildIt={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText("bare-id")).toBeInTheDocument();
  });

  it("clicking Build it invokes the handler with the node and closes", async () => {
    const user = userEvent.setup();
    const onBuildIt = vi.fn();
    const onClose = vi.fn();
    render(
      <NodeContextMenu node={node} position={{ x: 0, y: 0 }} onBuildIt={onBuildIt} onClose={onClose} />,
    );
    await user.click(screen.getByRole("menuitem", { name: /Build it/i }));
    expect(onBuildIt).toHaveBeenCalledWith(node);
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key closes the menu", () => {
    const onClose = vi.fn();
    render(
      <NodeContextMenu node={node} position={{ x: 0, y: 0 }} onBuildIt={() => {}} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking outside the menu closes it", () => {
    const onClose = vi.fn();
    render(
      <NodeContextMenu node={node} position={{ x: 0, y: 0 }} onBuildIt={() => {}} onClose={onClose} />,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("positions the menu at the cursor coordinates", () => {
    render(
      <NodeContextMenu node={node} position={{ x: 150, y: 250 }} onBuildIt={() => {}} onClose={() => {}} />,
    );
    const menu = screen.getByRole("menu");
    expect(menu).toHaveStyle({ left: "150px", top: "250px" });
  });
});
