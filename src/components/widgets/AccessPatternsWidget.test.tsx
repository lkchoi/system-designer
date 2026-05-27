import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccessPatternsWidget from "./AccessPatternsWidget";
import { parseYaml } from "./yaml-helpers";

describe("AccessPatternsWidget", () => {
  it("renders empty-state when value is empty", () => {
    render(<AccessPatternsWidget value="" onChange={() => {}} />);
    expect(screen.getByText(/No patterns yet/i)).toBeInTheDocument();
  });

  it("labels the first pattern as [base] and subsequent as [GSI N]", () => {
    const yaml = `
- name: Get user
  partition: "USER#<userId>"
- name: List by email
  partition: "EMAIL#<email>"
`.trim();
    render(<AccessPatternsWidget value={yaml} onChange={() => {}} />);
    expect(screen.getByText("[base]")).toBeInTheDocument();
    expect(screen.getByText("[GSI 1]")).toBeInTheDocument();
  });

  it("adds a new pattern when '+ pattern' is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccessPatternsWidget value="" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /\+ pattern/i }));
    expect(onChange).toHaveBeenCalled();
    const parsed = parseYaml<Array<{ name: string }>>(onChange.mock.calls[0][0]);
    expect(parsed?.[0].name).toBe("Base pattern");
  });

  it("falls back to a raw textarea when YAML isn't a list", () => {
    render(<AccessPatternsWidget value="not-a-list: foo" onChange={() => {}} />);
    expect(screen.getByText(/must be a list/i)).toBeInTheDocument();
  });

  it("clears the value to '' when the last pattern is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const yaml = `- name: only\n  partition: "X#<id>"\n`;
    render(<AccessPatternsWidget value={yaml} onChange={onChange} />);
    await user.click(screen.getByTitle("Remove"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
