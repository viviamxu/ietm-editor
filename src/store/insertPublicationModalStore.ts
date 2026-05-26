import type { Editor } from '@tiptap/core'
import { create } from 'zustand'

/** 出版物弹框用途：插图 vs 多媒体 */
export type InsertPublicationMode = 'image' | 'multimedia'

type InsertPublicationModalState = {
  isOpen: boolean
  editor: Editor | null
  mode: InsertPublicationMode
  /** 每次打开递增，供弹窗 `key` 重置内部表单状态 */
  openNonce: number
  openInsertPublication: (
    editor: Editor,
    mode?: InsertPublicationMode,
  ) => void
  closeInsertPublication: () => void
}

export const useInsertPublicationModalStore = create<InsertPublicationModalState>(
  (set) => ({
    isOpen: false,
    editor: null,
    mode: 'image',
    openNonce: 0,
    openInsertPublication: (editor, mode = 'image') =>
      set((s) => ({
        isOpen: true,
        editor,
        mode,
        openNonce: s.openNonce + 1,
      })),
    closeInsertPublication: () =>
      set({ isOpen: false, editor: null, mode: 'image' }),
  }),
)
