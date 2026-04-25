import { render, type RenderOptions } from "@testing-library/react";
import { ModeContext, StressContext, type Mode, type StressContextValue } from "./App";
import type { ReactNode } from "react";

const defaultStressValue: StressContextValue = {
  effects: new Map(),
  partitionedEdges: new Set(),
  slowEdges: new Set(),
  stressConfig: { trafficMultiplier: 1, latencyThreshold: 500 },
};

interface WrapperOptions {
  mode?: Mode;
  stress?: Partial<StressContextValue>;
}

function createWrapper({ mode = "plan", stress }: WrapperOptions = {}) {
  const stressValue = { ...defaultStressValue, ...stress };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ModeContext.Provider value={mode}>
        <StressContext.Provider value={stressValue}>{children}</StressContext.Provider>
      </ModeContext.Provider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, "wrapper">,
) {
  const { mode, stress, ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: createWrapper({ mode, stress }),
    ...renderOptions,
  });
}

export { screen, within, act, cleanup } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
