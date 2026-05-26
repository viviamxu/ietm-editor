import { Extension } from '@tiptap/core'

import { canDemoteNesting, demoteNesting } from '../../lib/editor/demoteNesting'
import { canPromoteNesting, promoteNesting } from '../../lib/editor/promoteNesting'

/**
 * Tab / Shift-Tab 列表与 levelledPara 层级：使用 `demoteNesting` / `promoteNesting`，
 * 不依赖 StarterKit ListKeymap 对 `paragraph` 的 `sinkListItem`（`listItem` 已为 `para+`）。
 */
export const S1000DNestingKeymap = Extension.create({
  name: 's1000dNestingKeymap',
  priority: 1010,

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!canDemoteNesting(editor)) return false
        return demoteNesting(editor)
      },
      'Shift-Tab': ({ editor }) => {
        if (!canPromoteNesting(editor)) return false
        return promoteNesting(editor)
      },
    }
  },
})
