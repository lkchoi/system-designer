import { useState, useCallback, useRef } from "react";
import { ulid } from "ulid";
import type {
  SystemNodeData,
  EdgeData,
  StressConfig,
  StressMutation,
  StressScenario,
} from "../types";

export function useStressRecording(
  onUpdateNodeData: (id: string, partial: Partial<SystemNodeData>) => void,
  onUpdateEdgeData: (id: string, partial: Partial<EdgeData>) => void,
  resetStress: () => void,
  setStressConfig: React.Dispatch<React.SetStateAction<StressConfig>>,
) {
  const [stressScenarios, setStressScenarios] = useState<StressScenario[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recordBuffer = useRef<StressMutation[]>([]);
  const recordStart = useRef(0);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const recordMutation = useCallback(
    (mutation: Omit<StressMutation, "timestamp">) => {
      if (!isRecording) return;
      recordBuffer.current.push({
        ...mutation,
        timestamp: Date.now() - recordStart.current,
      });
    },
    [isRecording],
  );

  const onUpdateNodeDataR = useCallback(
    (id: string, partial: Partial<SystemNodeData>) => {
      recordMutation({ type: "node", targetId: id, data: partial as Record<string, unknown> });
      onUpdateNodeData(id, partial);
    },
    [onUpdateNodeData, recordMutation],
  );

  const onUpdateEdgeDataR = useCallback(
    (id: string, partial: Partial<EdgeData>) => {
      recordMutation({ type: "edge", targetId: id, data: partial as Record<string, unknown> });
      onUpdateEdgeData(id, partial);
    },
    [onUpdateEdgeData, recordMutation],
  );

  const setStressConfigR = useCallback(
    (updater: (prev: StressConfig) => StressConfig) => {
      setStressConfig((prev) => {
        const next = updater(prev);
        recordMutation({ type: "config", data: next as unknown as Record<string, unknown> });
        return next;
      });
    },
    [setStressConfig, recordMutation],
  );

  const resetStressR = useCallback(() => {
    recordMutation({ type: "reset", data: {} });
    resetStress();
  }, [resetStress, recordMutation]);

  const startRecording = useCallback(() => {
    resetStress();
    recordBuffer.current = [];
    recordStart.current = Date.now();
    setIsRecording(true);
  }, [resetStress]);

  const stopRecording = useCallback((name: string) => {
    setIsRecording(false);
    if (recordBuffer.current.length === 0) return;
    const scenario: StressScenario = {
      id: ulid(),
      name,
      mutations: recordBuffer.current,
      duration: Date.now() - recordStart.current,
    };
    setStressScenarios((prev) => [...prev, scenario]);
    recordBuffer.current = [];
  }, []);

  const playScenario = useCallback(
    (scenario: StressScenario) => {
      resetStress();
      setIsPlaying(true);
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (const mutation of scenario.mutations) {
        timers.push(
          setTimeout(() => {
            if (mutation.type === "node" && mutation.targetId) {
              onUpdateNodeData(mutation.targetId, mutation.data as Partial<SystemNodeData>);
            } else if (mutation.type === "edge" && mutation.targetId) {
              onUpdateEdgeData(mutation.targetId, mutation.data as Partial<EdgeData>);
            } else if (mutation.type === "config") {
              setStressConfig(mutation.data as unknown as StressConfig);
            } else if (mutation.type === "reset") {
              resetStress();
            }
          }, mutation.timestamp),
        );
      }
      timers.push(
        setTimeout(() => {
          setIsPlaying(false);
        }, scenario.duration + 100),
      );
      playbackTimers.current = timers;
    },
    [resetStress, onUpdateNodeData, onUpdateEdgeData, setStressConfig],
  );

  const stopPlayback = useCallback(() => {
    for (const t of playbackTimers.current) clearTimeout(t);
    playbackTimers.current = [];
    setIsPlaying(false);
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setStressScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    isRecording,
    isPlaying,
    stressScenarios,
    onUpdateNodeDataR,
    onUpdateEdgeDataR,
    setStressConfigR,
    resetStressR,
    startRecording,
    stopRecording,
    playScenario,
    stopPlayback,
    deleteScenario,
  };
}
