import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import {
  collectSectionNumberAssignments,
  computeLevelledParaSectionPath,
  isChapterSectionTitle,
  normalizeSectionNumberAttr,
  sectionNumberAttrsEqual,
  stripLeadingSectionNumberFromTitleNode,
} from "../../lib/s1000d/sectionNumbers";

export const s1000dSectionNumbersKey = new PluginKey<{
  forceInitialSync?: true;
}>("s1000d-section-numbers");

const TITLE = "title";

function pathFromSectionNumber(sectionNumber: string): number[] | null {
  const trimmed = sectionNumber.trim().replace(/\.$/, "");
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  const path: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 1) return null;
    path.push(Math.round(n));
  }
  return path.length > 0 ? path : null;
}

export function createS1000dSectionNumbersPlugin() {
  return new Plugin({
    key: s1000dSectionNumbersKey,
    appendTransaction(transactions, _oldState, newState) {
      const docChanged = transactions.some((tr) => tr.docChanged);
      const forced = transactions.some((tr) => {
        const meta = tr.getMeta(s1000dSectionNumbersKey);
        return meta?.forceInitialSync === true;
      });
      if (!docChanged && !forced) return null;

      const assignments = collectSectionNumberAssignments(newState.doc);
      const stripImportedPrefix = forced;

      let tr = newState.tr;
      let changed = false;

      const sorted = [...assignments].sort((a, b) => b.titlePos - a.titlePos);
      for (const { titlePos, sectionNumber } of sorted) {
        const node = tr.doc.nodeAt(titlePos);
        if (!node || node.type.name !== TITLE) continue;

        const curr = normalizeSectionNumberAttr(
          (node.attrs as { sectionNumber?: string | null }).sectionNumber,
        );
        const next = sectionNumber;

        let titleNode = node;
        let contentChanged = false;

        if (
          stripImportedPrefix &&
          next &&
          isChapterSectionTitle(tr.doc, titlePos)
        ) {
          const path =
            pathFromSectionNumber(next) ??
            computeLevelledParaSectionPath(tr.doc, titlePos);
          if (path.length > 0) {
            const stripped = stripLeadingSectionNumberFromTitleNode(
              titleNode,
              path,
            );
            if (stripped.changed) {
              titleNode = stripped.node;
              contentChanged = true;
            }
          }
        }

        const attrsChanged = !sectionNumberAttrsEqual(curr, next);
        if (!attrsChanged && !contentChanged) continue;

        const attrs = attrsChanged
          ? { ...titleNode.attrs, sectionNumber: next }
          : titleNode.attrs;

        if (contentChanged) {
          tr = tr.replaceWith(
            titlePos,
            titlePos + node.nodeSize,
            titleNode.type.create(attrs, titleNode.content),
          );
        } else {
          tr = tr.setNodeMarkup(titlePos, undefined, attrs);
        }
        changed = true;
      }

      return changed ? tr : null;
    },
    view(editorView: EditorView) {
      queueMicrotask(() => {
        if (editorView.isDestroyed) return;
        editorView.dispatch(
          editorView.state.tr.setMeta(s1000dSectionNumbersKey, {
            forceInitialSync: true,
          }),
        );
      });
      return {};
    },
  });
}

/** 描述类 DM：章节标题自动序号（仅编辑区展示，不入库） */
export const S1000dSectionNumbersExtension = Extension.create({
  name: "s1000dSectionNumbers",
  priority: 1015,
  addProseMirrorPlugins() {
    return [createS1000dSectionNumbersPlugin()];
  },
});

/** 在 `setContent` / 加载 DM 后触发序号重算 */
export function dispatchSectionNumbersSync(editor: {
  view: EditorView;
}): void {
  if (editor.view.isDestroyed) return;
  editor.view.dispatch(
    editor.view.state.tr.setMeta(s1000dSectionNumbersKey, {
      forceInitialSync: true,
    }),
  );
}
