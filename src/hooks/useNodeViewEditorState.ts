import type { Editor } from "@tiptap/react";
import { useEffect, useReducer } from "react";

import { deferEditorMutation } from "../lib/editor/deferEditorMutation";
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
      deferEditorMutation(bump);
    };
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
  return { readOnly: !editor.isEditable, docVersion };
}

type EditorSyncEvent = "transaction" | "selectionUpdate" | "update";

/** 组合输入期间跳过回调；同步回调推迟到微任务，避免与 NodeView flushSync 冲突。 */
export function useImeSafeEditorSync(
  editor: Editor,
  events: EditorSyncEvent[],
  onSync: () => void,
): void {
  useEffect(() => {
    const handler = () => {
      if (isEditorComposing(editor)) return;
      deferEditorMutation(onSync);
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
