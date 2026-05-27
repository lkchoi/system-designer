import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OperationsListWidget from "./OperationsListWidget";
import { parseYaml } from "./yaml-helpers";

describe("OperationsListWidget", () => {
  it("renders empty-state when value is empty", () => {
    render(<OperationsListWidget value="" onChange={() => {}} />);
    expect(screen.getByText(/No operators yet/i)).toBeInTheDocument();
  });

  it("renders one row per operation in order with 1-based numbering", () => {
    const yaml = `
- kind: map
  body: extract userId
- kind: filter
  body: amount > 0
`.trim();
    render(<OperationsListWidget value={yaml} onChange={() => {}} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("extract userId")).toBeInTheDocument();
    expect(screen.getByDisplayValue("amount > 0")).toBeInTheDocument();
  });

  it("adding a 'map' operator emits YAML with a body field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OperationsListWidget value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "+ map" }));
    const parsed = parseYaml<Array<{ kind: string; body?: string }>>(onChange.mock.calls[0][0]);
    expect(parsed?.[0].kind).toBe("map");
    expect(parsed?.[0]).toHaveProperty("body");
  });

  it("adding a 'window' operator emits window_type + duration, not body", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OperationsListWidget value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "+ window" }));
    const parsed = parseYaml<Array<{ kind: string; window_type?: string; duration?: string; body?: string }>>(
      onChange.mock.calls[0][0],
    );
    expect(parsed?.[0].kind).toBe("window");
    expect(parsed?.[0].window_type).toBe("tumbling");
    expect(parsed?.[0].duration).toBe("5m");
    expect(parsed?.[0].body).toBeUndefined();
  });

  it("falls back to a raw textarea when YAML isn't a list", () => {
    render(<OperationsListWidget value="not-a-list: foo" onChange={() => {}} />);
    expect(screen.getByText(/must be a list/i)).toBeInTheDocument();
  });

  it("moving an operator down reorders the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const yaml = `- kind: map\n  body: a\n- kind: filter\n  body: b\n`;
    render(<OperationsListWidget value={yaml} onChange={onChange} />);
    // First "Move down" button (for the first operator).
    const downButtons = screen.getAllByTitle("Move down");
    await user.click(downButtons[0]);
    const parsed = parseYaml<Array<{ kind: string; body?: string }>>(onChange.mock.calls[0][0]);
    expect(parsed?.[0].kind).toBe("filter");
    expect(parsed?.[1].kind).toBe("map");
  });
});
