import { create } from "zustand";

import type { InspectTarget } from "../lib/editor/resolveInspectable";

type PropertyPanelState = {
  /** 表格行等 NodeView 内显式钉住的检视目标（覆盖当前选区解析） */
  pinnedInspect: InspectTarget | null;
  /** 递增以触发编辑器打开属性侧栏 */
  openPanelNonce: number;
  pinInspect: (target: InspectTarget | null) => void;
  requestOpenPropertyPanel: () => void;
};

export const usePropertyPanelStore = create<PropertyPanelState>((set) => ({
  pinnedInspect: null,
  openPanelNonce: 0,
  pinInspect: (target) => set({ pinnedInspect: target }),
  requestOpenPropertyPanel: () =>
    set((s) => ({ openPanelNonce: s.openPanelNonce + 1 })),
}));
