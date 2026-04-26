import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HotkeyHelpOverlay from "./HotkeyHelpOverlay";

describe("HotkeyHelpOverlay", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<HotkeyHelpOverlay open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders heading when open", () => {
    render(<HotkeyHelpOverlay open onClose={() => {}} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("renders all hotkey categories", () => {
    render(<HotkeyHelpOverlay open onClose={() => {}} />);
    for (const category of [
      "Mode",
      "Canvas",
      "Flow Path",
      "Panels",
      "Quick Add",
      "Tools",
      "Help",
    ]) {
      expect(screen.getByText(category)).toBeInTheDocument();
    }
  });

  it("renders hotkey labels", () => {
    render(<HotkeyHelpOverlay open onClose={() => {}} />);
    expect(screen.getByText("Plan mode")).toBeInTheDocument();
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText("Show shortcuts")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HotkeyHelpOverlay open onClose={onClose} />);

    await user.click(screen.getByText("Keyboard Shortcuts").closest(".fixed")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when dialog body is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HotkeyHelpOverlay open onClose={onClose} />);

    await user.click(screen.getByText("Keyboard Shortcuts"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HotkeyHelpOverlay open onClose={onClose} />);

    await user.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
