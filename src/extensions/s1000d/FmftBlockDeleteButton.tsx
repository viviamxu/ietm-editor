import type { NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import {
  useCallback,
  useReducer,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useImeSafeEditorSync, useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";
import {
  canDeleteFmftBlock,
  deleteFmftBlockAtPos,
} from "../../lib/editor/fmftBlockDelete";

export function FmftBlockDeleteButton(props: {
  editor: NodeViewProps["editor"];
  getPos: NodeViewProps["getPos"];
  blockLabel: string;
  className: string;
}) {
  const { editor, getPos, blockLabel, className } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useImeSafeEditorSync(editor, ["update", "selectionUpdate"], bump);

  const blockPos = typeof getPos === "function" ? getPos() : null;
  const canDelete =
    blockPos != null && canDeleteFmftBlock(editor.state.doc, blockPos);

  const deleteBlock = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editor.isEditable || blockPos == null) return;
      deleteFmftBlockAtPos(editor, blockPos);
    },
    [editor, blockPos],
  );

  return (
    <button
      type="button"
      className={className}
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
