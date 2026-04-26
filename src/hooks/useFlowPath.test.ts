import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlowPath } from "./useFlowPath";

vi.mock("../db", () => ({
  saveFlowPath: vi.fn(),
  deleteFlowPath: vi.fn(),
}));

describe("useFlowPath", () => {
  it("starts with path mode off and empty path", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    expect(result.current.isPathMode).toBe(false);
    expect(result.current.flowPath).toEqual([]);
  });

  it("initializes savedFlows from the initial argument", () => {
    const flows = [{ id: "f1", name: "Login", description: "", steps: ["a", "b"] }];
    const { result } = renderHook(() => useFlowPath("d1", flows));
    expect(result.current.savedFlows).toEqual(flows);
  });

  it("togglePathMode toggles on and off, clearing path on activate", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));

    // Activate
    act(() => result.current.togglePathMode());
    expect(result.current.isPathMode).toBe(true);

    // Add a step then deactivate
    act(() => result.current.appendToPath("n1"));
    expect(result.current.flowPath).toEqual(["n1"]);

    act(() => result.current.togglePathMode());
    expect(result.current.isPathMode).toBe(false);

    // Re-activate should clear the path
    act(() => result.current.togglePathMode());
    expect(result.current.isPathMode).toBe(true);
    expect(result.current.flowPath).toEqual([]);
  });

  it("appendToPath adds a node to the path", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    act(() => result.current.appendToPath("n1"));
    act(() => result.current.appendToPath("n2"));
    expect(result.current.flowPath).toEqual(["n1", "n2"]);
  });

  it("appendToPath removes the last step if clicked again", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    act(() => result.current.appendToPath("n1"));
    act(() => result.current.appendToPath("n2"));
    act(() => result.current.appendToPath("n2")); // undo last
    expect(result.current.flowPath).toEqual(["n1"]);
  });

  it("clearPath resets the flow and active flow ID", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    act(() => result.current.appendToPath("n1"));
    act(() => result.current.clearPath());
    expect(result.current.flowPath).toEqual([]);
    expect(result.current.activeFlowId).toBeNull();
  });

  it("saveFlow persists a named flow and resets the form", async () => {
    const { saveFlowPath } = await import("../db");
    const { result } = renderHook(() => useFlowPath("d1", []));

    act(() => result.current.appendToPath("n1"));
    act(() => result.current.appendToPath("n2"));
    act(() => result.current.setSaveName("Login Flow"));
    act(() => result.current.setSaveDesc("User login path"));
    act(() => result.current.saveFlow());

    expect(result.current.savedFlows).toHaveLength(1);
    expect(result.current.savedFlows[0].name).toBe("Login Flow");
    expect(result.current.savedFlows[0].description).toBe("User login path");
    expect(result.current.savedFlows[0].steps).toEqual(["n1", "n2"]);
    expect(result.current.saveName).toBe("");
    expect(result.current.saveDesc).toBe("");
    expect(result.current.showSaveForm).toBe(false);
    expect(saveFlowPath).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ name: "Login Flow" }),
    );
  });

  it("saveFlow does nothing when name is empty", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    act(() => result.current.appendToPath("n1"));
    act(() => result.current.setSaveName("   ")); // whitespace only
    act(() => result.current.saveFlow());
    expect(result.current.savedFlows).toHaveLength(0);
  });

  it("saveFlow does nothing when path is empty", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    act(() => result.current.setSaveName("Test"));
    act(() => result.current.saveFlow());
    expect(result.current.savedFlows).toHaveLength(0);
  });

  it("deleteFlow removes a saved flow", async () => {
    const { deleteFlowPath } = await import("../db");
    const flows = [{ id: "f1", name: "Login", description: "", steps: ["a"] }];
    const { result } = renderHook(() => useFlowPath("d1", flows));

    act(() => result.current.deleteFlow("f1"));
    expect(result.current.savedFlows).toHaveLength(0);
    expect(deleteFlowPath).toHaveBeenCalledWith("f1");
  });

  it("loadFlow sets the path and activates path mode", () => {
    const flow = { id: "f1", name: "Login", description: "", steps: ["a", "b", "c"] };
    const { result } = renderHook(() => useFlowPath("d1", [flow]));

    act(() => result.current.loadFlow(flow));
    expect(result.current.flowPath).toEqual(["a", "b", "c"]);
    expect(result.current.activeFlowId).toBe("f1");
    expect(result.current.isPathMode).toBe(true);
  });

  it("openSaveForm sets showSaveForm to true", () => {
    const { result } = renderHook(() => useFlowPath("d1", []));
    expect(result.current.showSaveForm).toBe(false);
    act(() => result.current.openSaveForm());
    expect(result.current.showSaveForm).toBe(true);
  });
});
