import type { Editor } from '@tiptap/core'
import { create } from 'zustand'

type InsertPublicationModalState = {
  isOpen: boolean
  editor: Editor | null
  /** 每次打开递增，供弹窗 `key` 重置内部表单状态 */
  openNonce: number
  openInsertPublication: (editor: Editor) => void
  closeInsertPublication: () => void
}

export const useInsertPublicationModalStore = create<InsertPublicationModalState>(
  (set) => ({
    isOpen: false,
    editor: null,
    openNonce: 0,
    openInsertPublication: (editor) =>
      set((s) => ({
        isOpen: true,
        editor,
        openNonce: s.openNonce + 1,
      })),
    closeInsertPublication: () => set({ isOpen: false, editor: null }),
  }),
)
