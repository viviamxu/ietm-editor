import type { Editor } from "@tiptap/core";
import { create } from "zustand";

export type AttentionChoiceKind = "warning" | "caution" | "note";

export type InsertAttentionChoiceIntent =
  | { mode: "afterBlock"; afterBlockPos: number }
  | { mode: "fromNoSafety"; reqSafetyPos: number };

type InsertAttentionChoiceModalState = {
  isOpen: boolean;
  editor: Editor | null;
  intent: InsertAttentionChoiceIntent | null;
  openNonce: number;
  openInsertAttentionChoice: (
    editor: Editor,
    intent: InsertAttentionChoiceIntent,
  ) => void;
  closeInsertAttentionChoice: () => void;
};

export const useInsertAttentionChoiceModalStore =
  create<InsertAttentionChoiceModalState>((set) => ({
    isOpen: false,
    editor: null,
    intent: null,
    openNonce: 0,
    openInsertAttentionChoice: (editor, intent) =>
      set((s) => ({
        isOpen: true,
        editor,
        intent,
        openNonce: s.openNonce + 1,
      })),
    closeInsertAttentionChoice: () =>
      set({
        isOpen: false,
        editor: null,
        intent: null,
      }),
  }));

export function openInsertAttentionChoiceModal(
  editor: Editor,
  intent: InsertAttentionChoiceIntent,
): void {
  useInsertAttentionChoiceModalStore
    .getState()
    .openInsertAttentionChoice(editor, intent);
}
