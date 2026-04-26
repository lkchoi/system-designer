import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStressRecording } from "./useStressRecording";
import type { StressConfig } from "../types";

const defaultConfig: StressConfig = { trafficMultiplier: 1, latencyThreshold: 500 };

function setup() {
  const onUpdateNodeData = vi.fn();
  const onUpdateEdgeData = vi.fn();
  const resetStress = vi.fn();
  const setStressConfig = vi.fn((updater: (prev: StressConfig) => StressConfig) =>
    updater(defaultConfig),
  );

  const hook = renderHook(() =>
    useStressRecording(onUpdateNodeData, onUpdateEdgeData, resetStress, setStressConfig),
  );

  return { hook, onUpdateNodeData, onUpdateEdgeData, resetStress, setStressConfig };
}

describe("useStressRecording", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts in idle state", () => {
    const { hook } = setup();
    expect(hook.result.current.isRecording).toBe(false);
    expect(hook.result.current.isPlaying).toBe(false);
    expect(hook.result.current.stressScenarios).toEqual([]);
  });

  it("startRecording resets stress and sets isRecording", () => {
    const { hook, resetStress } = setup();
    act(() => hook.result.current.startRecording());
    expect(hook.result.current.isRecording).toBe(true);
    expect(resetStress).toHaveBeenCalled();
  });

  it("recording-aware wrappers forward to base callbacks", () => {
    const { hook, onUpdateNodeData, onUpdateEdgeData } = setup();

    act(() => hook.result.current.onUpdateNodeDataR("n1", { label: "test" }));
    expect(onUpdateNodeData).toHaveBeenCalledWith("n1", { label: "test" });

    act(() => hook.result.current.onUpdateEdgeDataR("e1", { label: "conn" }));
    expect(onUpdateEdgeData).toHaveBeenCalledWith("e1", { label: "conn" });
  });

  it("setStressConfigR forwards to setStressConfig", () => {
    const { hook, setStressConfig } = setup();
    const updater = (prev: StressConfig) => ({ ...prev, trafficMultiplier: 5 });
    act(() => hook.result.current.setStressConfigR(updater));
    expect(setStressConfig).toHaveBeenCalled();
  });

  it("resetStressR calls resetStress", () => {
    const { hook, resetStress } = setup();
    act(() => hook.result.current.resetStressR());
    expect(resetStress).toHaveBeenCalled();
  });

  it("stopRecording with no mutations does not create a scenario", () => {
    const { hook } = setup();
    act(() => hook.result.current.startRecording());
    act(() => hook.result.current.stopRecording("empty"));
    expect(hook.result.current.isRecording).toBe(false);
    expect(hook.result.current.stressScenarios).toHaveLength(0);
  });

  it("stopRecording with mutations creates a named scenario", () => {
    const { hook } = setup();
    act(() => hook.result.current.startRecording());
    act(() => hook.result.current.onUpdateNodeDataR("n1", { stressFailure: "overloaded" }));
    act(() => hook.result.current.stopRecording("Overload Test"));

    expect(hook.result.current.isRecording).toBe(false);
    expect(hook.result.current.stressScenarios).toHaveLength(1);
    expect(hook.result.current.stressScenarios[0].name).toBe("Overload Test");
    expect(hook.result.current.stressScenarios[0].mutations.length).toBe(1);
  });

  it("playScenario replays mutations on a timer", () => {
    const { hook, onUpdateNodeData, resetStress } = setup();

    // Record a scenario
    act(() => hook.result.current.startRecording());
    act(() => hook.result.current.onUpdateNodeDataR("n1", { stressFailure: "down" }));
    act(() => hook.result.current.stopRecording("Down Test"));

    resetStress.mockClear();
    onUpdateNodeData.mockClear();

    // Play it back
    act(() => hook.result.current.playScenario(hook.result.current.stressScenarios[0]));
    expect(hook.result.current.isPlaying).toBe(true);
    expect(resetStress).toHaveBeenCalled();

    // Advance timers to trigger the mutation
    act(() => vi.runAllTimers());
    expect(onUpdateNodeData).toHaveBeenCalledWith("n1", { stressFailure: "down" });
    expect(hook.result.current.isPlaying).toBe(false);
  });

  it("stopPlayback clears timers and sets isPlaying to false", () => {
    const { hook } = setup();

    // Record and play
    act(() => hook.result.current.startRecording());
    act(() => hook.result.current.onUpdateNodeDataR("n1", { stressFailure: "down" }));
    act(() => hook.result.current.stopRecording("Test"));
    act(() => hook.result.current.playScenario(hook.result.current.stressScenarios[0]));

    expect(hook.result.current.isPlaying).toBe(true);
    act(() => hook.result.current.stopPlayback());
    expect(hook.result.current.isPlaying).toBe(false);
  });

  it("deleteScenario removes a scenario by ID", () => {
    const { hook } = setup();

    act(() => hook.result.current.startRecording());
    act(() => hook.result.current.onUpdateNodeDataR("n1", { stressFailure: "down" }));
    act(() => hook.result.current.stopRecording("Test"));

    const id = hook.result.current.stressScenarios[0].id;
    act(() => hook.result.current.deleteScenario(id));
    expect(hook.result.current.stressScenarios).toHaveLength(0);
  });
});
