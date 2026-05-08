import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * S1000D `emphasis`：带 `emphasisType` 的特别强调（行内 Mark）。
 * 常见取值：`em01`（偏粗体强调）、`em02`（偏斜体强调）；缺省时按 `em01` 处理。
 *
 * @see Bike 示例 XML `<emphasis emphasisType="em01">`、`em02`
 */
export const S1000DEmphasis = Mark.create({
  name: 's1000dEmphasis',
  inclusive: true,

  addAttributes() {
    return {
      emphasisType: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('emphasisType') ??
          element.getAttribute('emphasistype'),
        renderHTML: (attributes) => {
          const t = attributes.emphasisType as string | undefined | null
          if (!t) return {}
          return { 'data-emphasis-type': t }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'emphasis',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          const raw =
            el.getAttribute('emphasisType') ??
            el.getAttribute('emphasistype')
          return {
            emphasisType: raw ?? 'em01',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'emphasis',
      mergeAttributes(HTMLAttributes, {
        class: 's1000d-emphasis',
      }),
    ]
  },
})
