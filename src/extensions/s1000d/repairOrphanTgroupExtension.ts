import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import { createPluginComposingGuard } from "../../lib/editor/imeComposition";

const repairOrphanTgroupKey = new PluginKey("repairOrphanTgroup");

function tgroupHasValidCols(tgroup: PMNode): boolean {
  const cols = tgroup.attrs.cols;
  return typeof cols === "string" && cols.trim() !== "";
}

/** Backspace 等操作偶发插入的空壳 tgroup：无 cols、仅 1×1。 */
function isSpuriousCorruptTgroup(tgroup: PMNode): boolean {
  if (tgroup.type.name !== "tgroup") return false;
  if (tgroupHasValidCols(tgroup)) return false;

  let bodySections = 0;
  let rowCount = 0;
  let maxEntryCount = 0;

  tgroup.forEach((section) => {
    const sectionName = section.type.name;
    if (sectionName !== "tbody" && sectionName !== "thead") return;
    if (sectionName === "tbody") bodySections += 1;
    section.forEach((row) => {
      if (row.type.name !== "row") return;
      rowCount += 1;
      maxEntryCount = Math.max(maxEntryCount, row.childCount);
    });
  });

  return bodySections >= 1 && rowCount === 1 && maxEntryCount === 1;
}

function collectTgroupRepairRanges(doc: PMNode): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "tgroup") return;
    if (doc.resolve(pos).parent.type.name === "table") return;
    ranges.push({ from: pos, to: pos + node.nodeSize });
  });

  doc.descendants((node, pos) => {
    if (node.type.name !== "table") return;

    const tgroups: { pos: number; node: PMNode }[] = [];
    let childPos = pos + 1;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type.name === "tgroup") {
        tgroups.push({ pos: childPos, node: child });
      }
      childPos += child.nodeSize;
    }

    if (tgroups.length <= 1) return;

    const hasValidTgroup = tgroups.some(({ node: tg }) => tgroupHasValidCols(tg));
    if (!hasValidTgroup) return;

    for (const { pos: tgPos, node: tg } of tgroups) {
      if (!isSpuriousCorruptTgroup(tg)) continue;
      ranges.push({ from: tgPos, to: tgPos + tg.nodeSize });
    }
  });

  return ranges;
}

/**
 * `tgroup` 仅允许作为 XML `table` 子节点；若因 Backspace / DOM 同步脱壳落到
 * `proceduralStep` 等容器下，在事务结束后删除孤立 `tgroup`。
 * 同一 `table` 内若已有合法 `tgroup`，则移除 Backspace 偶发插入的空壳重复 `tgroup`。
 */
export const RepairOrphanTgroupExtension = Extension.create({
  name: "repairOrphanTgroup",

  addProseMirrorPlugins() {
    const composingGuard = createPluginComposingGuard();
    return [
      new Plugin({
        key: repairOrphanTgroupKey,
        appendTransaction(transactions, _oldState, newState) {
          if (composingGuard.isComposing()) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const ranges = collectTgroupRepairRanges(newState.doc);
          if (ranges.length === 0) return null;

          let tr = newState.tr;
          ranges.sort((a, b) => b.from - a.from);
          for (const { from, to } of ranges) {
            tr = tr.delete(from, to);
          }
          return tr;
        },
        view(editorView: EditorView) {
          return composingGuard.bindView(editorView);
        },
      }),
    ];
  },
});
