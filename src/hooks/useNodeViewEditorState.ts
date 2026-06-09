import type { Editor } from "@tiptap/react";
import { useEffect, useReducer } from "react";

/** 订阅文档与可编辑态变化，供 NodeView 内 React 控件同步 `editor.isEditable`。 */
export function useNodeViewEditorState(editor: Editor): { readOnly: boolean } {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const on = () => bump();
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
  return { readOnly: !editor.isEditable };
}
