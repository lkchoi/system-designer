import { useState, useCallback, useRef } from "react";
import { ulid } from "ulid";
import type { SavedFlow } from "../types";
import { saveFlowPath, deleteFlowPath } from "../db";

export function useFlowPath(
  designId: string,
  initialFlowPaths: SavedFlow[],
) {
  const [flowPath, setFlowPath] = useState<string[]>([]);
  const [isPathMode, setIsPathMode] = useState(false);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>(initialFlowPaths);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const pathStepsRef = useRef<HTMLDivElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);

  const togglePathMode = useCallback(() => {
    setIsPathMode((prev) => {
      if (!prev) setFlowPath([]);
      return !prev;
    });
  }, []);

  const clearPath = useCallback(() => {
    setFlowPath([]);
    setActiveFlowId(null);
  }, []);

  const saveFlow = useCallback(() => {
    if (!saveName.trim() || flowPath.length === 0) return;
    const flow: SavedFlow = {
      id: ulid(),
      name: saveName.trim(),
      description: saveDesc.trim(),
      steps: [...flowPath],
    };
    saveFlowPath(designId, flow);
    setSavedFlows((prev) => [...prev, flow]);
    setShowSaveForm(false);
    setSaveName("");
    setSaveDesc("");
    setActiveFlowId(flow.id);
  }, [saveName, saveDesc, flowPath, designId]);

  const deleteFlow = useCallback(
    (id: string) => {
      deleteFlowPath(id);
      setSavedFlows((prev) => prev.filter((f) => f.id !== id));
      if (activeFlowId === id) setActiveFlowId(null);
    },
    [activeFlowId],
  );

  const loadFlow = useCallback((flow: SavedFlow) => {
    setFlowPath(flow.steps);
    setActiveFlowId(flow.id);
    setIsPathMode(true);
  }, []);

  const appendToPath = useCallback((nodeId: string) => {
    setFlowPath((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === nodeId) {
        return prev.slice(0, -1);
      }
      return [...prev, nodeId];
    });
  }, []);

  const openSaveForm = useCallback(() => {
    setShowSaveForm(true);
    setTimeout(() => saveNameRef.current?.focus(), 0);
  }, []);

  return {
    flowPath,
    isPathMode,
    savedFlows,
    showSaveForm,
    setShowSaveForm,
    saveName,
    setSaveName,
    saveDesc,
    setSaveDesc,
    activeFlowId,
    pathStepsRef,
    saveNameRef,
    togglePathMode,
    clearPath,
    saveFlow,
    deleteFlow,
    loadFlow,
    appendToPath,
    openSaveForm,
  };
}
