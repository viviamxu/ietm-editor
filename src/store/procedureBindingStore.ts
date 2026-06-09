import { create } from "zustand";

import type { ProcedureBindingConfig } from "../types/procedureAnimationBinding";

type ProcedureBindingState = ProcedureBindingConfig & {
  setProcedureBindingConfig: (config: ProcedureBindingConfig | null) => void;
  resetProcedureBindingConfig: () => void;
};

const EMPTY: ProcedureBindingConfig = {};

export const useProcedureBindingStore = create<ProcedureBindingState>((set) => ({
  ...EMPTY,
  setProcedureBindingConfig: (config) =>
    set({
      onFetchDerivativeBindingTree: config?.onFetchDerivativeBindingTree,
    }),
  resetProcedureBindingConfig: () => set({ ...EMPTY }),
}));
