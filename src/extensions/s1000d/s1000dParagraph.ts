import { mergeAttributes, Node } from '@tiptap/core'

import {
  readParaAttrsFromDom,
  s1000dParaAttributeSpec,
} from '../../lib/s1000d/paraAttributes'

/**
 * 列表项内段落：与 StarterKit `paragraph` 同名，但带全套 S1000D 属性。
 * 使用 `listParagraph` 组，避免进入 `doc` 的 `block+`（防止尾随块退化成奇怪节点）。
 */
export const S1000DParagraph = Node.create({
  name: 'paragraph',

  priority: 1000,

  group: 'listParagraph',

  content: 'inline*',

  addAttributes() {
    return s1000dParaAttributeSpec()
  },

  parseHTML() {
    return [
      {
        tag: 'p',
        priority: 200,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return readParaAttrsFromDom(el)
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Shift-Enter': ({ editor }) => {
        const { $from } = editor.state.selection
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name !== 'paragraph') continue
          const parent = d > 1 ? $from.node(d - 1) : null
          if (parent?.type.name === 'listItem') {
            return editor.chain().focus().splitBlock().run()
          }
          return false
        }
        return false
      },
    }
  },
})
