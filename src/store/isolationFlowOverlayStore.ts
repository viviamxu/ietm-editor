import { create } from "zustand";

import type { IsolationFlowPayload } from "../lib/s1000d/isolationFlowBridge";

interface IsolationFlowOverlayState {
  session: IsolationFlowPayload | null;
  editableBeforeOpen: boolean;
  open: (payload: IsolationFlowPayload, editableBeforeOpen: boolean) => void;
  close: () => void;
}

export const useIsolationFlowOverlayStore = create<IsolationFlowOverlayState>(
  (set) => ({
    session: null,
    editableBeforeOpen: true,
    open: (payload, editableBeforeOpen) =>
      set((state) => ({
        session: payload,
        editableBeforeOpen: state.session
          ? state.editableBeforeOpen
          : editableBeforeOpen,
      })),
    close: () => set({ session: null }),
  }),
);
