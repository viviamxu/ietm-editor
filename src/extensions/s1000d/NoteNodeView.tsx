import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Brackets } from "lucide-react";
import { AttentionBlockContinueHint } from "./AttentionBlockContinueHint";
import { AttentionBlockDeleteButton } from "./AttentionBlockDeleteButton";
import {
  AttentionBlockSymbolIconButton,
  readFirstAttentionSymbolFromBlock,
} from "./attentionBlockSymbolIcon";
import { useNodeViewEditorState, useImeSafeEditorSync } from "../../hooks/useNodeViewEditorState";
import { openInsertSymbolModalForAttentionBlock } from "../../lib/editor/insertSymbols";
import {
  useCallback,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

function NoteInfoIcon() {
  return (
    <svg
      className="s1000d-attention-lead__icon-svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="8.25" r="1.15" fill="currentColor" />
      <path
        d="M12 11.25v6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function selectionOnNoteBlock(props: NodeViewProps): {
  nodeSelected: boolean;
  caretInside: boolean;
} {
  const { editor, getPos, node } = props;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return { nodeSelected: false, caretInside: false };

  const sel = editor.state.selection;
  if (sel instanceof NodeSelection && sel.from === pos) {
    return { nodeSelected: true, caretInside: true };
  }

  const { from } = sel;
  let $from;
  try {
    $from = editor.state.doc.resolve(from);
  } catch {
    return { nodeSelected: false, caretInside: false };
  }

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === node.type.name && $from.before(d) === pos) {
      return { nodeSelected: false, caretInside: true };
    }
  }
  return { nodeSelected: false, caretInside: false };
}

/** `noteLead`：仅可编辑引导文；图标在父级 `note` 左侧固定列展示。 */
export function NoteLeadNodeView(props: NodeViewProps) {
  void props;
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-attention-lead"
      data-s1000d-lead-kind="note"
    >
      <NodeViewContent className="s1000d-attention-lead__text" />
    </NodeViewWrapper>
  );
}

/** `note` 块级外壳：与 warning/caution 共用左右布局与 attention 样式类。 */
export function NoteNodeView(props: NodeViewProps) {
  const { editor, getPos, node } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const [hovered, setHovered] = useState(false);
  const [, bumpFromDoc] = useReducer((n: number) => n + 1, 0);

  const attentionSymbol = readFirstAttentionSymbolFromBlock(node);
  const hasAttentionSymbol = attentionSymbol != null;

  useImeSafeEditorSync(editor, ["selectionUpdate", "transaction"], bumpFromDoc);

  const { nodeSelected, caretInside } = selectionOnNoteBlock(props);
  const showChrome = hovered || caretInside || nodeSelected;

  const selectWholeBlock = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const p = getPos?.();
      if (p == null) return;
      editor.chain().focus().setNodeSelection(p).run();
    },
    [editor, getPos],
  );

  const openInsertSymbolFromIcon = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (readOnly) return;
      const p = getPos?.();
      if (p == null) return;
      openInsertSymbolModalForAttentionBlock(editor, p);
    },
    [editor, getPos, readOnly],
  );

  const wrapClass = showChrome
    ? "s1000d-attention-block-wrap s1000d-attention-block-wrap--chrome"
    : "s1000d-attention-block-wrap";
  const asideClass = showChrome
    ? "s1000d-attention-block s1000d-attention-block--note s1000d-attention-block--chrome"
    : "s1000d-attention-block s1000d-attention-block--note";

  return (
    <NodeViewWrapper
      as="div"
      className={wrapClass}
      data-s1000d-node="note"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e: ReactMouseEvent<HTMLDivElement>) => {
        const next = e.relatedTarget;
        if (next instanceof globalThis.Node && e.currentTarget.contains(next))
          return;
        setHovered(false);
      }}
    >
      <aside className={asideClass} role="note">
      <AttentionBlockDeleteButton
        editor={editor}
        getPos={getPos}
        blockLabel="note"
      />
      <button
        type="button"
        className="s1000d-attention-block__block-handle"
        contentEditable={false}
        tabIndex={-1}
        aria-label="选中整块 note"
        title="选中整块"
        onMouseDown={selectWholeBlock}
      >
        <Brackets size={14} strokeWidth={2} aria-hidden />
      </button>
      <div className="s1000d-attention-block__row">
        <div className="s1000d-attention-block__icon-col">
          <AttentionBlockSymbolIconButton
            readOnly={readOnly}
            symbol={attentionSymbol}
            ariaLabelInsert="插入注释符号"
            ariaLabelReplace="更换注释符号"
            onPick={openInsertSymbolFromIcon}
            defaultIcon={<NoteInfoIcon />}
          />
        </div>
        <NodeViewContent
          className={
            hasAttentionSymbol
              ? "s1000d-attention-block__content-col s1000d-attention-block__content-col--hide-inline-symbol"
              : "s1000d-attention-block__content-col"
          }
        />
      </div>
      </aside>
      <AttentionBlockContinueHint
        editor={editor}
        getPos={getPos}
        node={node}
        visible={showChrome}
      />
    </NodeViewWrapper>
  );
}

/** `notePara`：前导与 attention 列表同级块流。 */
export function NoteParaNodeView(props: NodeViewProps) {
  void props;
  return (
    <NodeViewWrapper as="div" className="s1000d-attention-block__body-item">
      <NodeViewContent className="s1000d-attention-block__body-item__content" />
    </NodeViewWrapper>
  );
}
