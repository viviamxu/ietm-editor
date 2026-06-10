import { Extension } from "@tiptap/core";

import { handleTrailingParaAfterHostBackspace } from "../../lib/editor/insertParaAfterFmftBlock";

/**
 * 宿主块（表 / warning 等）后的 trailing `para`：行首 Backspace 安全删除空段；
 * 非空段行首不选中 isolating 表。删除后若有子步骤则跳入子块编辑。
 */
export const S1000DHostBlockTrailingParaBackspaceKeymap = Extension.create({
  name: "s1000dHostBlockTrailingParaBackspaceKeymap",
  priority: 1025,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => handleTrailingParaAfterHostBackspace(editor),
    };
  },
});
