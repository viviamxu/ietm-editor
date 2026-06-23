import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useReducer, type MouseEvent } from "react";

import {
  insertParaAfterHostBlock,
  shouldShowHostBlockContinueHint,
} from "../../lib/editor/insertParaAfterFmftBlock";
import { useImeSafeEditorSync } from "../../hooks/useNodeViewEditorState";

/**
 * 图 / 表 / 多媒体等宿主块底缘「点击此处继续输入」：真实 DOM，提示在块外壳外。
 */
export function HostBlockContinueHint(props: {
  editor: Editor;
  getPos: NodeViewProps["getPos"];
  node: PMNode;
  visible: boolean;
}) {
  const { editor, getPos, node, visible } = props;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useImeSafeEditorSync(editor, ["selectionUpdate", "update"], bump);

  const blockPos = typeof getPos === "function" ? getPos() : undefined;
  const doc = editor.state.doc;
  const showHint =
    visible &&
    editor.isEditable &&
    blockPos != null &&
    shouldShowHostBlockContinueHint(doc, blockPos, node);

  const onHintMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos == null || !editor.isEditable) return;
      const block = editor.state.doc.nodeAt(pos);
      if (!block) return;
      insertParaAfterHostBlock(editor, pos, block);
    },
    [editor, getPos],
  );

  if (!showHint) return null;

  return (
    <div
      className="s1000d-host-block-continue-hint"
      contentEditable={false}
      role="button"
      tabIndex={-1}
      onMouseDown={onHintMouseDown}
    >
      点击此处继续输入
    </div>
  );
}
