import { Extension } from "@tiptap/core";

import { handleFmftBlockEnter } from "../../lib/editor/insertParaAfterFmftBlock";

/**
 * 程序类 / 描述类：选中 `table` / `figure` / `multimedia` / `warning` / `caution` / `note`
 * 后按 Enter，或光标位于块后间隙时按 Enter，插入（或聚焦）trailing `para`。
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
