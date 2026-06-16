import type { Editor } from '@tiptap/core'
import { create } from 'zustand'

/** 出版物弹框用途：插图 vs 多媒体 */
export type InsertPublicationMode = 'image' | 'multimedia'

/**
 * 图解类 fmft 插入意图：
 * - `sibling`：工具栏插入 → 在当前 figure/multimedia 后新增同级块
 * - `intoBlock`：NodeView「添加图片」等 → 写入当前块内部
 */
export type FmftInsertIntent = 'sibling' | 'intoBlock'

type InsertPublicationModalState = {
  isOpen: boolean
  editor: Editor | null
  mode: InsertPublicationMode
  fmftInsertIntent: FmftInsertIntent
  /** 每次打开递增，供弹窗 `key` 重置内部表单状态 */
  openNonce: number
  openInsertPublication: (
    editor: Editor,
    mode?: InsertPublicationMode,
    options?: { fmftInsertIntent?: FmftInsertIntent },
  ) => void
  closeInsertPublication: () => void
}

export const useInsertPublicationModalStore = create<InsertPublicationModalState>(
  (set) => ({
    isOpen: false,
    editor: null,
    mode: 'image',
    fmftInsertIntent: 'sibling',
    openNonce: 0,
    openInsertPublication: (editor, mode = 'image', options) =>
      set((s) => ({
        isOpen: true,
        editor,
        mode,
        fmftInsertIntent: options?.fmftInsertIntent ?? 'sibling',
        openNonce: s.openNonce + 1,
      })),
    closeInsertPublication: () =>
      set({
        isOpen: false,
        editor: null,
        mode: 'image',
        fmftInsertIntent: 'sibling',
      }),
  }),
)
