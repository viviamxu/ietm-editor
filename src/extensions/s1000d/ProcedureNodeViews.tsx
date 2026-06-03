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

import { useProcedureSectionHeading } from "../../hooks/useProcedureSectionHeading";

function selectionInsideBlock(
  props: NodeViewProps,
  blockType: string,
): { nodeSelected: boolean; caretInside: boolean } {
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
    if ($from.node(d).type.name === blockType && $from.before(d) === pos) {
      return { nodeSelected: false, caretInside: true };
    }
  }
  return { nodeSelected: false, caretInside: false };
}

function BlockHandleButton({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className="s1000d-procedure-section__block-handle"
      contentEditable={false}
      tabIndex={-1}
      aria-label={label}
      title="选中整块"
      onMouseDown={onSelect}
    >
      <Brackets size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}

function ProcedureSectionNodeView({
  props,
  blockType,
  className,
  dataNode,
}: {
  props: NodeViewProps;
  blockType: string;
  className: string;
  dataNode: string;
}) {
  const { editor, getPos } = props;
  const { full: heading } = useProcedureSectionHeading(props);
  const [hovered, setHovered] = useState(false);
  const [, bumpFromSelection] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const bump = () => bumpFromSelection();
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  const { nodeSelected, caretInside } = selectionInsideBlock(props, blockType);
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
      as="section"
      className={
        showChrome ? `${className} s1000d-procedure-section--chrome` : className
      }
      data-s1000d-node={dataNode}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {heading ? (
        <header
          className="s1000d-procedure-section__header"
          contentEditable={false}
        >
          <span className="s1000d-procedure-section__heading">{heading}</span>
          <BlockHandleButton
            label={`选中整块 ${dataNode}`}
            onSelect={selectWholeBlock}
          />
        </header>
      ) : null}
      <NodeViewContent className="s1000d-procedure-section__content" />
    </NodeViewWrapper>
  );
}

export function PreliminaryRqmtsNodeView(props: NodeViewProps) {
  return (
    <ProcedureSectionNodeView
      props={props}
      blockType="preliminaryRqmts"
      className="s1000d-procedure-section s1000d-procedure-section--preliminary"
      dataNode="preliminaryRqmts"
    />
  );
}

export function MainProcedureNodeView(props: NodeViewProps) {
  return (
    <ProcedureSectionNodeView
      props={props}
      blockType="mainProcedure"
      className="s1000d-procedure-section s1000d-procedure-section--main"
      dataNode="mainProcedure"
    />
  );
}

export function CloseRqmtsNodeView(props: NodeViewProps) {
  return (
    <ProcedureSectionNodeView
      props={props}
      blockType="closeRqmts"
      className="s1000d-procedure-section s1000d-procedure-section--close"
      dataNode="closeRqmts"
    />
  );
}

export function ProceduralStepNodeView(props: NodeViewProps) {
  const { editor, getPos, HTMLAttributes } = props;
  const [hovered, setHovered] = useState(false);
  const [, bumpFromSelection] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const bump = () => bumpFromSelection();
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  const { nodeSelected, caretInside } = selectionInsideBlock(
    props,
    "proceduralStep",
  );
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
      as="div"
      className={
        showChrome
          ? "s1000d-procedural-step s1000d-procedural-step--chrome"
          : "s1000d-procedural-step"
      }
      data-s1000d-node="proceduralStep"
      {...HTMLAttributes}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="s1000d-procedural-step__block-handle"
        contentEditable={false}
        tabIndex={-1}
        aria-label="选中整块 proceduralStep"
        title="选中整块"
        onMouseDown={selectWholeBlock}
      >
        <Brackets size={14} strokeWidth={2} aria-hidden />
      </button>
      <NodeViewContent className="s1000d-procedural-step__content" />
    </NodeViewWrapper>
  );
}

export function ReqGroupNodeView(props: NodeViewProps) {
  const { full: label } = useProcedureSectionHeading(props);
  const nodeName = props.node.type.name;
  const parentName = (() => {
    const pos = typeof props.getPos === "function" ? props.getPos() : null;
    if (pos == null) return "";
    const $pos = props.editor.state.doc.resolve(pos);
    return $pos.depth > 0 ? $pos.node($pos.depth).type.name : "";
  })();
  const isTableLikeGroup =
    nodeName === "reqSupportEquips" ||
    nodeName === "reqSupplies" ||
    nodeName === "reqSpares";
  const hideLabelInCloseRqmts =
    nodeName === "reqCondGroup" && parentName === "closeRqmts";
  const displayLabel = hideLabelInCloseRqmts ? "" : label;

  return (
    <NodeViewWrapper
      as="div"
      className={
        isTableLikeGroup
          ? "s1000d-procedure-req-group s1000d-procedure-req-group--table-like"
          : "s1000d-procedure-req-group"
      }
      data-s1000d-node={nodeName}
    >
      {displayLabel ? (
        <div
          className={
            isTableLikeGroup
              ? "s1000d-procedure-req-group__label s1000d-procedure-req-group__label--table-like"
              : "s1000d-procedure-req-group__label"
          }
          contentEditable={false}
        >
          {displayLabel}
        </div>
      ) : null}
      <NodeViewContent className="s1000d-procedure-req-group__content" />
    </NodeViewWrapper>
  );
}

export function EquipDescrNodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-procedure-equip-descr"
      data-s1000d-node={props.node.type.name}
    >
      <NodeViewContent className="s1000d-procedure-equip-descr__content" />
    </NodeViewWrapper>
  );
}
