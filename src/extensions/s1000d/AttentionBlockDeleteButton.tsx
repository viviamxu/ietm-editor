import type { NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useReducer,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";
import {
  canDeleteAttentionBlock,
  deleteAttentionBlockAtPos,
} from "../../lib/s1000d/attentionBlockDelete";

export function AttentionBlockDeleteButton(props: {
  editor: NodeViewProps["editor"];
  getPos: NodeViewProps["getPos"];
  blockLabel: string;
}) {
  const { editor, getPos, blockLabel } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const on = () => bump();
    editor.on("update", on);
    editor.on("selectionUpdate", on);
    return () => {
      editor.off("update", on);
      editor.off("selectionUpdate", on);
    };
  }, [editor]);

  const blockPos = typeof getPos === "function" ? getPos() : null;
  const canDelete =
    blockPos != null && canDeleteAttentionBlock(editor.state.doc, blockPos);

  const deleteBlock = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editor.isEditable || blockPos == null) return;
      deleteAttentionBlockAtPos(editor, blockPos);
    },
    [editor, blockPos],
  );

  return (
    <button
      type="button"
      className="s1000d-attention-block__delete"
      contentEditable={false}
      tabIndex={-1}
      disabled={readOnly || !canDelete}
      title={canDelete ? `删除此${blockLabel}` : `无法删除此${blockLabel}`}
      aria-label={`删除此${blockLabel}`}
      onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
      onClick={deleteBlock}
    >
      <Trash2 size={14} aria-hidden />
    </button>
  );
}
