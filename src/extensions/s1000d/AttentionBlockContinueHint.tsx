import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useReducer, type MouseEvent } from "react";

import { insertParaAfterHostBlock } from "../../lib/editor/insertParaAfterFmftBlock";

const TRAILING_PARA_TYPES = new Set(["para", "paragraph"]);

function lacksTrailingPara(
  editor: Editor,
  blockPos: number,
  block: PMNode,
): boolean {
  const insertPos = blockPos + block.nodeSize;
  const $insert = editor.state.doc.resolve(insertPos);
  const nextIndex = $insert.index();
  const parent = $insert.parent;
  if (nextIndex >= parent.childCount) return true;
  return !TRAILING_PARA_TYPES.has(parent.child(nextIndex).type.name);
}

/**
 * warning / caution / note 底缘「点击此处继续输入」：真实 DOM + 直接 insert，
 * 避免 CSS 伪元素在 mousedown 时无法可靠触发 PM 插件插入。
 */
export function AttentionBlockContinueHint(props: {
  editor: Editor;
  getPos: NodeViewProps["getPos"];
  node: PMNode;
  visible: boolean;
}) {
  const { editor, getPos, node, visible } = props;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const refresh = () => bump();
    editor.on("selectionUpdate", refresh);
    editor.on("update", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("update", refresh);
    };
  }, [editor]);

  const blockPos = typeof getPos === "function" ? getPos() : undefined;
  const showHint =
    visible &&
    editor.isEditable &&
    blockPos != null &&
    lacksTrailingPara(editor, blockPos, node);

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
