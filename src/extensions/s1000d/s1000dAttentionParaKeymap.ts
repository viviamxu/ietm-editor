import { Extension } from "@tiptap/core";

import {
  backspaceAttentionRandomListItem,
  handleAttentionInlineBackspace,
  handleAttentionInlineDelete,
  handleAttentionParaEnter,
  hardBreakInAttentionInline,
} from "../../lib/s1000d/attentionParaEnter";

/**
 * warning / caution / note 内 Enter 与 Shift+Enter：
 * - Enter：新 `warningAndCautionPara` / `notePara`，或新 `attentionRandomListItem`
 * - Shift+Enter：段内 `hardBreak`
 * - Backspace：空 attention 列表项删除；lead 边界处拦截，防止跳出 isolating 块
 */
export const S1000dAttentionParaKeymap = Extension.create({
  name: "s1000dAttentionParaKeymap",
  priority: 1030,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => handleAttentionParaEnter(editor),
      "Shift-Enter": ({ editor }) => hardBreakInAttentionInline(editor),
      Delete: ({ editor }) => handleAttentionInlineDelete(editor),
      Backspace: ({ editor }) =>
        backspaceAttentionRandomListItem(editor) ||
        handleAttentionInlineBackspace(editor),
    };
  },
});
