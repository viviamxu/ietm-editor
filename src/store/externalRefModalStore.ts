import type { Editor } from "@tiptap/core";
import { create } from "zustand";

type ExternalRefModalState = {
  isOpen: boolean;
  editor: Editor | null;
  openNonce: number;
  openExternalRef: (editor: Editor) => void;
  closeExternalRef: () => void;
};

export const useExternalRefModalStore = create<ExternalRefModalState>(
  (set) => ({
    isOpen: false,
    editor: null,
    openNonce: 0,
    openExternalRef: (editor) =>
      set((s) => ({
        isOpen: true,
        editor,
        openNonce: s.openNonce + 1,
      })),
    closeExternalRef: () => set({ isOpen: false, editor: null }),
  }),
);
