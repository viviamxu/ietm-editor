import { Extension } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import {
  isInternalEditorPaste,
  sanitizeExternalPasteSlice,
} from "../../lib/editor/stripPastedMarks";
import { shouldHandleWordTablePaste } from "../../lib/s1000d/pasteWordTable";

function sliceSingleNode(slice: Slice) {
  return slice.openStart === 0 &&
    slice.openEnd === 0 &&
    slice.content.childCount === 1
    ? slice.content.firstChild
    : null;
}

function dispatchPastedSlice(view: EditorView, slice: Slice, preferPlain: boolean) {
  const singleNode = sliceSingleNode(slice);
  const tr = singleNode
    ? view.state.tr.replaceSelectionWith(singleNode, preferPlain)
    : view.state.tr.replaceSelection(slice);
  view.dispatch(
    tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"),
  );
}

/**
 * 外部粘贴：保留段落/列表等块结构，清除行内样式，丢弃图片节点。
 * 编辑器内部复制（含 `data-pm-slice`）不受影响。
 */
export const StripExternalPasteMarksExtension = Extension.create({
  name: "stripExternalPasteMarks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste(view, event, slice) {
            const html = event.clipboardData?.getData("text/html") ?? "";
            const plain = event.clipboardData?.getData("text/plain") ?? "";

            if (isInternalEditorPaste(html)) return false;
            if (shouldHandleWordTablePaste(html, plain)) return false;
            if (!html && !plain) return false;

            const sanitized = sanitizeExternalPasteSlice(slice, view.state.schema);
            if (sanitized.content.size === 0) return true;

            dispatchPastedSlice(view, sanitized, false);
            return true;
          },
        },
      }),
    ];
  },
});
