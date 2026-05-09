import { Mark, mergeAttributes } from '@tiptap/core'

/** 与样例 XML `<subScript>` / `<superScript>` 对应；导入时 HTML 多为小写 `subscript`/`superscript`。 */
export const S1000DSub = Mark.create({
  name: 's1000dSub',
  inclusive: true,

  parseHTML() {
    return [
      { tag: 'sub' },
      { tag: 'subscript' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0]
  },
})

export const S1000DSup = Mark.create({
  name: 's1000dSup',
  inclusive: true,

  parseHTML() {
    return [
      { tag: 'sup' },
      { tag: 'superscript' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0]
  },
})
