import { create } from "zustand";

import defaultProcedureDictionaries from "../data/procedureDictionaries.json";
import type { ProcedureDictionaries } from "../types/procedureDictionaries";

const DEFAULT_DICTIONARIES =
  defaultProcedureDictionaries as ProcedureDictionaries;

type ProcedureDictionaryState = {
  dictionaries: ProcedureDictionaries;
  setProcedureDictionaries: (next: ProcedureDictionaries) => void;
  resetProcedureDictionaries: () => void;
};

export const useProcedureDictionaryStore = create<ProcedureDictionaryState>(
  (set) => ({
    dictionaries: DEFAULT_DICTIONARIES,
    setProcedureDictionaries: (next) => set({ dictionaries: next }),
    resetProcedureDictionaries: () =>
      set({ dictionaries: DEFAULT_DICTIONARIES }),
  }),
);

export function getProcedureDictionaries(): ProcedureDictionaries {
  return useProcedureDictionaryStore.getState().dictionaries;
}

export function setProcedureDictionaries(next: ProcedureDictionaries): void {
  useProcedureDictionaryStore.getState().setProcedureDictionaries(next);
}

export function resetProcedureDictionaries(): void {
  useProcedureDictionaryStore.getState().resetProcedureDictionaries();
}
