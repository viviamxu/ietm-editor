import { Extension } from "@tiptap/core";

import { handleFmftBlockEnter } from "../../lib/editor/insertParaAfterFmftBlock";

/**
 * 程序类 / 描述类：选中 `multimedia` / `figure` / `table` 后按 Enter，
 * 在其后插入（或聚焦）`para`。
 */
export const S1000DFmftBlockEnterKeymap = Extension.create({
  name: "s1000dFmftBlockEnterKeymap",
  priority: 1015,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => handleFmftBlockEnter(editor),
    };
  },
});
