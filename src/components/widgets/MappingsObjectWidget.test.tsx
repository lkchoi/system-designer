import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MappingsObjectWidget from "./MappingsObjectWidget";
import { parseYaml } from "./yaml-helpers";

describe("MappingsObjectWidget", () => {
  it("renders empty-state when value is empty", () => {
    render(<MappingsObjectWidget value="" onChange={() => {}} />);
    expect(screen.getByText(/No fields yet/i)).toBeInTheDocument();
  });

  it("renders a row per field with its type", () => {
    const yaml = "fields:\n  title: { type: text }\n  created_at: { type: date }\n";
    render(<MappingsObjectWidget value={yaml} onChange={() => {}} />);
    expect(screen.getByDisplayValue("title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("created_at")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("text").length).toBeGreaterThan(0);
  });

  it("adds a new field with default type 'text'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MappingsObjectWidget value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /\+ field/i }));
    const yaml = onChange.mock.calls[0][0];
    const parsed = parseYaml<{ fields: Record<string, { type: string }> }>(yaml);
    expect(parsed?.fields.new_field?.type).toBe("text");
  });

  it("preserves a custom settings block from raw YAML", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const yaml = `fields:\n  title: { type: text }\nsettings:\n  number_of_shards: 3\n`;
    render(<MappingsObjectWidget value={yaml} onChange={onChange} />);
    expect(screen.getByText(/preserving custom .settings. block/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\+ field/i }));
    const out = parseYaml<{ settings: { number_of_shards: number } }>(onChange.mock.calls[0][0]);
    expect(out?.settings?.number_of_shards).toBe(3);
  });

  it("falls back to a raw textarea on malformed YAML", () => {
    render(<MappingsObjectWidget value="this: is: : invalid" onChange={() => {}} />);
    expect(screen.getByText(/YAML parse failed/i)).toBeInTheDocument();
  });
});
