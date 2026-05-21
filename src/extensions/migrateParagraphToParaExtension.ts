import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import {
  INVALID_DOC_ROOT_BLOCK_TYPES,
  canMigrateParagraphUnderParent,
} from '../lib/editor/migrateParagraphToPara'

const migrateParagraphKey = new PluginKey<boolean>('migrateParagraphToPara')

function collectParagraphReplacements(
  doc: PMNode,
): { pos: number; attrs: Record<string, unknown>; content: PMNode['content'] }[] {
  const out: {
    pos: number
    attrs: Record<string, unknown>
    content: PMNode['content']
  }[] = []

  doc.forEach((node, offset) => {
    if (!INVALID_DOC_ROOT_BLOCK_TYPES.has(node.type.name)) return
    out.push({ pos: offset, attrs: { ...node.attrs }, content: node.content })
  })

  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const $pos = doc.resolve(pos)
    if (!canMigrateParagraphUnderParent($pos.parent.type.name)) return
    out.push({ pos, attrs: { ...node.attrs }, content: node.content })
  })

  return out
}

function createMigrateParagraphPlugin() {
  return new Plugin({
    key: migrateParagraphKey,
    appendTransaction(transactions, _oldState, newState) {
      const paraType = newState.schema.nodes.para
      if (!paraType) return null

      const docChanged = transactions.some((tr) => tr.docChanged)
      const forced = transactions.some(
        (tr) => tr.getMeta(migrateParagraphKey) === true,
      )
      if (!docChanged && !forced) return null

      const replacements = collectParagraphReplacements(newState.doc)
      if (replacements.length === 0) return null

      replacements.sort((a, b) => b.pos - a.pos)
      let tr = newState.tr
      for (const { pos, attrs, content } of replacements) {
        tr = tr.setNodeMarkup(pos, paraType, attrs, content)
      }
      tr.setMeta(migrateParagraphKey, false)
      return tr
    },
    view() {
      return {
        update(view, prevState) {
          if (prevState.doc.eq(view.state.doc)) return
          const paraType = view.state.schema.nodes.para
          if (!paraType) return
          if (collectParagraphReplacements(view.state.doc).length === 0) return
          const tr = view.state.tr.setMeta(migrateParagraphKey, true)
          view.dispatch(tr)
        },
      }
    },
  })
}

/** 将文档内可迁移的 `paragraph` 节点替换为 `para`（HTML 解析、旧 JSON 等） */
export const MigrateParagraphToParaExtension = Extension.create({
  name: 'migrateParagraphToPara',

  addProseMirrorPlugins() {
    return [createMigrateParagraphPlugin()]
  },
})
