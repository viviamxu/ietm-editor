import type { Editor } from "@tiptap/core";

import { useToolbarConfigStore } from "../../store/toolbarConfigStore";
import type { ToolbarItemContext } from "../../types/toolbar";

export function buildSymbolToolbarContext(
  editor: Editor,
  options: {
    attentionBlockPos?: number;
    attentionBlockType?: "warning" | "caution" | "note";
  } = {},
): ToolbarItemContext {
  return {
    editor,
    editable: editor.isEditable,
    activeTabKey: "insert",
    formatBarLocked: !editor.isEditable,
    attentionBlockPos: options.attentionBlockPos,
    attentionBlockType: options.attentionBlockType,
  };
}

/** 若宿主配置了 `onInsertSymbolClick` 则委托宿主，返回 `true`。 */
export function tryDelegateInsertSymbol(
  editor: Editor,
  options: {
    attentionBlockPos?: number;
    attentionBlockType?: "warning" | "caution" | "note";
  } = {},
): boolean {
  const onInsertSymbolClick =
    useToolbarConfigStore.getState().onInsertSymbolClick;
  if (!onInsertSymbolClick) return false;
  onInsertSymbolClick(buildSymbolToolbarContext(editor, options));
  return true;
}
