import { Extension } from "@tiptap/core";

import { deleteSelectedFmftInnerNode } from "../../lib/editor/fmftInnerNodeDelete";

/**
 * `figure` 内 `graphic`、`multimedia` 内 `multimediaObject`：
 * 点击图片/媒体选中后，Backspace / Delete 删除该子节点（非整块 figure / multimedia）。
 */
export const S1000DFmftInnerNodeDeleteKeymap = Extension.create({
  name: "s1000dFmftInnerNodeDeleteKeymap",
  priority: 1030,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => deleteSelectedFmftInnerNode(editor),
      Delete: ({ editor }) => deleteSelectedFmftInnerNode(editor),
    };
  },
});
