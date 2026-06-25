import { Extension } from "@tiptap/core";

import { insertParaAfterCrewDrillStepTitle } from "../../lib/s1000d/crewInsert";

/**
 * 操作类：`crewDrillStep` 的 `title` 末尾按 Enter 在 title 下方插入空 `para`。
 */
export const S1000DCrewDrillStepTitleEnterKeymap = Extension.create({
  name: "s1000dCrewDrillStepTitleEnterKeymap",
  priority: 1020,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => insertParaAfterCrewDrillStepTitle(editor),
    };
  },
});
