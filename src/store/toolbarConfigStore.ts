import { create } from "zustand";

import type { ToolbarConfig } from "../types/toolbar";

type ToolbarConfigState = ToolbarConfig & {
  setToolbarConfig: (config: ToolbarConfig | null) => void;
  resetToolbarConfig: () => void;
};

const EMPTY: ToolbarConfig = {};

export const useToolbarConfigStore = create<ToolbarConfigState>((set) => ({
  ...EMPTY,
  setToolbarConfig: (config) =>
    set({
      customItems: config?.customItems,
      hideBuiltinItems: config?.hideBuiltinItems,
      onInsertImageClick: config?.onInsertImageClick,
      onInsertFilmClick: config?.onInsertFilmClick,
      onInsertSymbolClick: config?.onInsertSymbolClick,
      onInsertExternalRefClick: config?.onInsertExternalRefClick,
      onOpenExternalRefTarget: config?.onOpenExternalRefTarget,
    }),
  resetToolbarConfig: () => set({ ...EMPTY }),
}));
