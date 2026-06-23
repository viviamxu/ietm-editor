import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useReducer, type MouseEvent } from "react";

import {
  insertParaAfterHostBlock,
  shouldShowHostBlockContinueHint,
  shouldShowSafetyAttentionContinueHint,
} from "../../lib/editor/insertParaAfterFmftBlock";
import { useImeSafeEditorSync } from "../../hooks/useNodeViewEditorState";
import { openInsertAttentionChoiceModal } from "../../store/insertAttentionChoiceModalStore";

/**
 * warning / caution / note 底缘「点击此处继续输入」：真实 DOM + 直接 insert，
 * 避免 CSS 伪元素在 mousedown 时无法可靠触发 PM 插件插入。
 * `safetyRqmts` 内点击后打开 attention 类型选择弹框。
 */
export function AttentionBlockContinueHint(props: {
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
  const showParaHint =
    blockPos != null &&
    shouldShowHostBlockContinueHint(doc, blockPos, node);
  const showSafetyHint =
    blockPos != null &&
    shouldShowSafetyAttentionContinueHint(doc, blockPos, node);
  const showHint =
    visible && editor.isEditable && blockPos != null && (showParaHint || showSafetyHint);

  const onHintMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos == null || !editor.isEditable) return;
      const block = editor.state.doc.nodeAt(pos);
      if (!block) return;
      if (shouldShowSafetyAttentionContinueHint(editor.state.doc, pos, block)) {
        openInsertAttentionChoiceModal(editor, {
          mode: "afterBlock",
          afterBlockPos: pos,
        });
        return;
      }
      insertParaAfterHostBlock(editor, pos, block);
    },
    [editor, getPos],
  );

  if (!showHint) return null;

  return (
    <div
      className="s1000d-attention-continue-hint"
      contentEditable={false}
      role="button"
      tabIndex={-1}
      onMouseDown={onHintMouseDown}
    >
      点击此处继续输入
    </div>
  );
}
