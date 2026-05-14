import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Brackets } from "lucide-react";
import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

function selectionOnThisFigure(props: NodeViewProps): {
  nodeSelected: boolean;
  caretInside: boolean;
} {
  const { editor, getPos } = props;
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
    if (
      $from.node(d).type.name === "figure" &&
      $from.before(d) === pos
    ) {
      return { nodeSelected: false, caretInside: true };
    }
  }
  return { nodeSelected: false, caretInside: false };
}

/**
 * S1000D `figure`：保留 ProseMirror 内容区（`title?` + `graphic+`）。
 * 右上角句柄：hover 或选区在本块内时显示，点击后 `NodeSelection` 选中整块。
 */
export function FigureNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  const [hovered, setHovered] = useState(false);
  const [, bumpFromSelection] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const bump = () => bumpFromSelection();
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  const { nodeSelected, caretInside } = selectionOnThisFigure(props);
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

  return (
    <NodeViewWrapper
      as="figure"
      className={
        showChrome
          ? "s1000d-figure s1000d-figure--chrome"
          : "s1000d-figure"
      }
      data-s1000d-node="figure"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="s1000d-figure__block-handle"
        contentEditable={false}
        tabIndex={-1}
        aria-label="选中整块 figure"
        title="选中整块"
        onMouseDown={selectWholeBlock}
      >
        <Brackets size={14} strokeWidth={2} aria-hidden />
      </button>
      <NodeViewContent className="s1000d-figure__content" />
    </NodeViewWrapper>
  );
}
