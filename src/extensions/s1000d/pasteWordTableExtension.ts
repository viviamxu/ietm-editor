import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

import { handleWordTablePaste } from "../../lib/s1000d/pasteWordTable";

/**
 * Word / Excel 表格粘贴：合并为一张 S1000D `table`，避免碎表 + 列表重复内容。
 */
export const PasteWordTableExtension = Extension.create({
  name: "pasteWordTable",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            return handleWordTablePaste(editor, event);
          },
        },
      }),
    ];
  },
});
