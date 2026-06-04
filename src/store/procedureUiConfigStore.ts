import { create } from "zustand";

import defaultProcedureUiConfig from "../data/procedureUiConfig.json";
import type { ProcedureUiConfig } from "../types/procedureUiConfig";

const DEFAULT_CONFIG = defaultProcedureUiConfig as ProcedureUiConfig;

type ProcedureUiConfigState = {
  config: ProcedureUiConfig;
  setProcedureUiConfig: (next: ProcedureUiConfig) => void;
  resetProcedureUiConfig: () => void;
};

export const useProcedureUiConfigStore = create<ProcedureUiConfigState>(
  (set) => ({
    config: DEFAULT_CONFIG,
    setProcedureUiConfig: (next) => set({ config: next }),
    resetProcedureUiConfig: () => set({ config: DEFAULT_CONFIG }),
  }),
);

export function getProcedureUiConfig(): ProcedureUiConfig {
  return useProcedureUiConfigStore.getState().config;
}

export function setProcedureUiConfig(next: ProcedureUiConfig): void {
  useProcedureUiConfigStore.getState().setProcedureUiConfig(next);
}

export function resetProcedureUiConfig(): void {
  useProcedureUiConfigStore.getState().resetProcedureUiConfig();
}
