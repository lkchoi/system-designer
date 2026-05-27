import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColumnsTableWidget from "./ColumnsTableWidget";
import { parseYaml } from "./yaml-helpers";

describe("ColumnsTableWidget", () => {
  it("renders an empty-state hint when value is empty", () => {
    render(<ColumnsTableWidget value="" onChange={() => {}} />);
    expect(screen.getByText(/No tables yet/i)).toBeInTheDocument();
  });

  it("renders one tab per declared table", () => {
    const yaml = "users:\n  - { name: id, type: uuid }\norders:\n  - { name: id, type: uuid }\n";
    render(<ColumnsTableWidget value={yaml} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "users" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "orders" })).toBeInTheDocument();
  });

  it("adding a table calls onChange with valid YAML", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColumnsTableWidget value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /\+ table/i }));
    expect(onChange).toHaveBeenCalled();
    const yaml = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const parsed = parseYaml<Record<string, unknown[]>>(yaml);
    expect(parsed).toBeTruthy();
    expect(Object.keys(parsed!)).toContain("new_table");
    // Includes a default `id uuid primary` column so the table isn't empty.
    expect(yaml).toContain("primary: true");
  });

  it("falls back to a raw textarea on invalid YAML", () => {
    render(<ColumnsTableWidget value="this: is: : not valid" onChange={() => {}} />);
    expect(screen.getByText(/YAML parse failed/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("clears the value back to empty string when the last table is dropped", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const yaml = "users:\n  - { name: id, type: uuid, primary: true }\n";
    render(<ColumnsTableWidget value={yaml} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /drop/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
