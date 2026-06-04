import { Extension } from "@tiptap/core";

import {
  handleAttentionParaEnter,
  hardBreakInAttentionInline,
} from "../../lib/s1000d/attentionParaEnter";

/**
 * warning / caution / note 内 Enter 与 Shift+Enter：
 * - Enter：新 `warningAndCautionPara` / `notePara`，或新 `attentionRandomListItem`
 * - Shift+Enter：段内 `hardBreak`
 */
export const S1000dAttentionParaKeymap = Extension.create({
  name: "s1000dAttentionParaKeymap",
  priority: 1030,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => handleAttentionParaEnter(editor),
      "Shift-Enter": ({ editor }) => hardBreakInAttentionInline(editor),
    };
  },
});
