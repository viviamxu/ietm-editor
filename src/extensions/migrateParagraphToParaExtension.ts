import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import {
  INVALID_DOC_ROOT_BLOCK_TYPES,
  canMigrateParagraphUnderParent,
} from "../lib/editor/migrateParagraphToPara";
import { createPluginComposingGuard } from "../lib/editor/imeComposition";

const migrateParagraphKey = new PluginKey<boolean>("migrateParagraphToPara");

type BlockReplacement = {
  pos: number;
  typeName: "para" | "paragraph";
  attrs: Record<string, unknown>;
  content: PMNode["content"];
};

function collectBlockNormalizations(doc: PMNode): BlockReplacement[] {
  const out: BlockReplacement[] = [];

  doc.forEach((node, offset) => {
    if (!INVALID_DOC_ROOT_BLOCK_TYPES.has(node.type.name)) return;
    out.push({
      pos: offset,
      typeName: "para",
      attrs: { ...node.attrs },
      content: node.content,
    });
  });

  doc.descendants((node, pos) => {
    const $pos = doc.resolve(pos);
    const parent = $pos.parent.type.name;

    if (node.type.name === "para" && parent === "listItem") {
      out.push({
        pos,
        typeName: "paragraph",
        attrs: { ...node.attrs },
        content: node.content,
      });
      return;
    }

    if (node.type.name !== "paragraph") return;
    if (parent === "listItem") return;
    if (!canMigrateParagraphUnderParent(parent)) return;
    out.push({
      pos,
      typeName: "para",
      attrs: { ...node.attrs },
      content: node.content,
    });
  });

  return out;
}

function createMigrateParagraphPlugin() {
  const composingGuard = createPluginComposingGuard();
  return new Plugin({
    key: migrateParagraphKey,
    appendTransaction(transactions, _oldState, newState) {
      if (composingGuard.isComposing()) return null;

      const paraType = newState.schema.nodes.para;
      const paragraphType = newState.schema.nodes.paragraph;
      if (!paraType || !paragraphType) return null;

      const docChanged = transactions.some((tr) => tr.docChanged);
      const forced = transactions.some(
        (tr) => tr.getMeta(migrateParagraphKey) === true,
      );
      if (!docChanged && !forced) return null;

      const replacements = collectBlockNormalizations(newState.doc);
      if (replacements.length === 0) return null;

      replacements.sort((a, b) => b.pos - a.pos);
      let tr = newState.tr;
      for (const { pos, typeName, attrs, content } of replacements) {
        const target = typeName === "paragraph" ? paragraphType : paraType;
        const node = tr.doc.nodeAt(pos);
        if (!node) continue;
        tr = tr.replaceWith(
          pos,
          pos + node.nodeSize,
          target.create(attrs, content),
        );
      }
      tr.setMeta(migrateParagraphKey, false);
      return tr;
    },
    view(editorView) {
      const guard = composingGuard.bindView(editorView);
      return {
        destroy: guard.destroy,
        update(view, prevState) {
          if (view.composing) return;
          if (prevState.doc.eq(view.state.doc)) return;
          const paraType = view.state.schema.nodes.para;
          const paragraphType = view.state.schema.nodes.paragraph;
          if (!paraType || !paragraphType) return;
          if (collectBlockNormalizations(view.state.doc).length === 0) return;
          const tr = view.state.tr.setMeta(migrateParagraphKey, true);
          view.dispatch(tr);
        },
      };
    },
  });
}

/** 将文档内可迁移的 `paragraph` 节点替换为 `para`（HTML 解析、旧 JSON 等） */
export const MigrateParagraphToParaExtension = Extension.create({
  name: "migrateParagraphToPara",

  addProseMirrorPlugins() {
    return [createMigrateParagraphPlugin()];
  },
});
