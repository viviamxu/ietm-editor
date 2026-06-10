import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const repairOrphanTgroupKey = new PluginKey("repairOrphanTgroup");

/**
 * `tgroup` 仅允许作为 XML `table` 子节点；若因 Backspace / DOM 同步脱壳落到
 * `proceduralStep` 等容器下，在事务结束后删除孤立 `tgroup`。
 */
export const RepairOrphanTgroupExtension = Extension.create({
  name: "repairOrphanTgroup",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: repairOrphanTgroupKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const ranges: { from: number; to: number }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "tgroup") return;
            if (newState.doc.resolve(pos).parent.type.name === "table") return;
            ranges.push({ from: pos, to: pos + node.nodeSize });
          });

          if (ranges.length === 0) return null;

          let tr = newState.tr;
          ranges.sort((a, b) => b.from - a.from);
          for (const { from, to } of ranges) {
            tr = tr.delete(from, to);
          }
          return tr;
        },
      }),
    ];
  },
});
