import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportDialog from "./ExportDialog";

vi.mock("../db/io", () => ({
  exportDesign: vi.fn(() => '{"nodes":[],"edges":[]}'),
  downloadFile: vi.fn(),
}));

describe("ExportDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    designId: "test-id",
    designName: "Test Design",
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <ExportDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Export Design heading when open", () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText("Export Design")).toBeInTheDocument();
  });

  it("renders format category headings", () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText("Diagram")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure as Code")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders format tiles", () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("Excalidraw")).toBeInTheDocument();
    expect(screen.getByText("Docker Compose")).toBeInTheDocument();
    expect(screen.getByText("Terraform")).toBeInTheDocument();
  });

  it("LocalStack checkbox starts unchecked", () => {
    render(<ExportDialog {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Prefer LocalStack/);
    expect(checkbox).not.toBeChecked();
  });

  it("CLAUDE.md checkbox starts checked", () => {
    render(<ExportDialog {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Include CLAUDE\.md/);
    expect(checkbox).toBeChecked();
  });

  it("toggles LocalStack checkbox", async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);
    const checkbox = screen.getByLabelText(/Prefer LocalStack/);

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText("Export Design").closest(".fixed")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog {...defaultProps} onClose={onClose} />);

    // Close button is the X button in the header
    const header = screen.getByText("Export Design").parentElement!;
    const closeBtn = header.querySelector("button")!;
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
