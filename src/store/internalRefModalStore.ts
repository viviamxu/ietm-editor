import type { Editor } from "@tiptap/core";
import { create } from "zustand";

type InternalRefModalState = {
  isOpen: boolean;
  editor: Editor | null;
  openNonce: number;
  openInternalRef: (editor: Editor) => void;
  closeInternalRef: () => void;
};

export const useInternalRefModalStore = create<InternalRefModalState>(
  (set) => ({
    isOpen: false,
    editor: null,
    openNonce: 0,
    openInternalRef: (editor) =>
      set((s) => ({
        isOpen: true,
        editor,
        openNonce: s.openNonce + 1,
      })),
    closeInternalRef: () => set({ isOpen: false, editor: null }),
  }),
);
