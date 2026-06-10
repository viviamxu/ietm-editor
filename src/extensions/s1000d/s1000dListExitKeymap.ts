import { Extension } from "@tiptap/core";

import {
  backspaceDescriptionListItem,
  exitDescriptionListAsPara,
} from "../../lib/editor/exitDescriptionList";

/**
 * 描述类列表（orderedList / bulletList）：
 * - Enter：空项退出列表并在其后插入 `para`
 * - Backspace：空项行首嵌套升一级，或删除顶层空项
 * 优先级高于 StarterKit ListKeymap，避免 lift 出非法的 `paragraph` 块。
 */
export const S1000DListExitKeymap = Extension.create({
  name: "s1000dListExitKeymap",
  priority: 1020,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => exitDescriptionListAsPara(editor),
      Backspace: ({ editor }) => backspaceDescriptionListItem(editor),
    };
  },
});
