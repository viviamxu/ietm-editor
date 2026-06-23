import type { Editor } from "@tiptap/react";
import { useEffect, useReducer } from "react";

import { isEditorComposing } from "../lib/editor/imeComposition";

/** 订阅文档与可编辑态变化，供 NodeView 内 React 控件同步 `editor.isEditable`。 */
export function useNodeViewEditorState(editor: Editor): {
  readOnly: boolean;
  docVersion: number;
} {
  const [docVersion, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const on = () => {
      if (isEditorComposing(editor)) return;
      bump();
    };
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
  return { readOnly: !editor.isEditable, docVersion };
}

type EditorSyncEvent = "transaction" | "selectionUpdate" | "update";

/** 组合输入期间跳过回调，避免 NodeView / 工具栏无意义重绘。 */
export function useImeSafeEditorSync(
  editor: Editor,
  events: EditorSyncEvent[],
  onSync: () => void,
): void {
  useEffect(() => {
    const handler = () => {
      if (isEditorComposing(editor)) return;
      onSync();
    };
    for (const event of events) {
      editor.on(event, handler);
    }
    return () => {
      for (const event of events) {
        editor.off(event, handler);
      }
    };
  }, [editor, events, onSync]);
}
