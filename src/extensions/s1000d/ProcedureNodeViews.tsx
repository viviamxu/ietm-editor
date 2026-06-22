import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Button } from "@arco-design/web-react";
import { Brackets, Plus, Trash2 } from "lucide-react";
import { ProceduralStepBindingMenu } from "./ProceduralStepBindingMenu";
import { bindProceduralStepDerivativeRef } from "../../lib/s1000d/bindProceduralStepAnimation";
import { useProcedureBindingStore } from "../../store/procedureBindingStore";
import type { DerivativeBindingTreeNode } from "../../types/procedureAnimationBinding";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";
import { useProcedureSectionHeading } from "../../hooks/useProcedureSectionHeading";
import {
  getReqCondNoRefIndex,
  insertReqCondNoRefAtEnd,
} from "../../lib/s1000d/reqCondRow";
import {
  canDeleteProceduralStep,
  deleteProceduralStepAtPos,
} from "../../lib/s1000d/procedureInsert";
import { openInsertAttentionChoiceModal } from "../../store/insertAttentionChoiceModalStore";
import {
  insertFirstEquipDescrGroupAtReq,
  type EquipReqContainerType,
} from "../../lib/s1000d/supportEquipRow";

function useEditorRefresh(editor: NodeViewProps["editor"]) {
  useNodeViewEditorState(editor);
}

/** `程序类.json` 要求 `proceduralStep` 含 `title`；缺则补空标题。 */
function ensureProceduralStepTitle(
  editor: NodeViewProps["editor"],
  getPos: NodeViewProps["getPos"],
  node: PMNode,
): void {
  let hasTitle = false;
  node.forEach((child) => {
    if (child.type.name === "title") hasTitle = true;
  });
  if (hasTitle || !editor.isEditable) return;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return;
  editor
    .chain()
    .insertContentAt(pos + 1, { type: "title", content: [] })
    .run();
}

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
  const { editor, getPos, node, HTMLAttributes } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tree, setTree] = useState<DerivativeBindingTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [, bumpFromSelection] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const bump = () => bumpFromSelection();
    editor.on("selectionUpdate", bump);
    editor.on("update", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("update", bump);
    };
  }, [editor]);

  useEffect(() => {
    ensureProceduralStepTitle(editor, getPos, node);
  }, [editor, getPos, node]);

  const { nodeSelected, caretInside } = selectionInsideBlock(
    props,
    "proceduralStep",
  );
  const showChrome = hovered || caretInside || nodeSelected || menuOpen;

  const stepPos = typeof getPos === "function" ? getPos() : null;
  const canDeleteStep =
    stepPos != null && canDeleteProceduralStep(editor.state.doc, stepPos);

  const boundId =
    String(node.attrs.derivativeClassificationRefId ?? "").trim() || null;

  const loadTree = useCallback(async () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    const handler =
      useProcedureBindingStore.getState().onFetchDerivativeBindingTree;
    if (!handler) {
      setTree([]);
      return;
    }
    setLoading(true);
    try {
      const data = await handler({
        editor,
        proceduralStepPos: pos,
        proceduralStepId: (node.attrs.id as string | null) ?? null,
      });
      setTree(data);
    } finally {
      setLoading(false);
    }
  }, [editor, getPos, node.attrs.id]);

  const onMenuVisibleChange = useCallback(
    (visible: boolean) => {
      setMenuOpen(visible);
      if (visible) void loadTree();
    },
    [loadTree],
  );

  const onBind = useCallback(
    (refId: string) => {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null || !editor.isEditable) return;
      bindProceduralStepDerivativeRef(editor, pos, refId);
      setMenuOpen(false);
    },
    [editor, getPos],
  );

  const deleteStep = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!editor.isEditable || stepPos == null) return;
      deleteProceduralStepAtPos(editor, stepPos);
    },
    [editor, stepPos],
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
      {showChrome ? (
        <ProceduralStepBindingMenu
          visible={menuOpen}
          disabled={readOnly}
          boundId={boundId}
          tree={tree}
          loading={loading}
          onBind={onBind}
          onVisibleChange={onMenuVisibleChange}
        />
      ) : null}
      {showChrome ? (
        <button
          type="button"
          className="s1000d-procedural-step__delete"
          contentEditable={false}
          disabled={readOnly || !canDeleteStep}
          title={canDeleteStep ? "删除此操作步骤" : "无法删除此操作步骤"}
          aria-label="删除此操作步骤"
          onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
          onClick={deleteStep}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      ) : null}
      <NodeViewContent className="s1000d-procedural-step__content" />
    </NodeViewWrapper>
  );
}

/** 程序类 `noConds` / `noSupportEquips` 等空占位：仅 UI 展示「无」。 */
export function ProcedureEmptyPlaceholderNodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-procedure-empty-placeholder"
      data-s1000d-node={props.node.type.name}
      contentEditable={false}
    >
      无
    </NodeViewWrapper>
  );
}

/** @deprecated 使用 {@link ProcedureEmptyPlaceholderNodeView} */
export const NoCondsNodeView = ProcedureEmptyPlaceholderNodeView;

/** `reqCondNoRef`：组内自动序号（1. 2. …），仅编辑区展示。 */
export function ReqCondNoRefNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  useEditorRefresh(editor);

  const index = useMemo(() => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return 1;
    return getReqCondNoRefIndex(editor.state.doc, pos);
  }, [editor.state.doc, getPos]);

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-req-cond-no-ref"
      data-s1000d-node="reqCondNoRef"
    >
      <span
        className="s1000d-req-cond-no-ref__number"
        contentEditable={false}
        aria-hidden
      >
        {index}.
      </span>
      <NodeViewContent className="s1000d-req-cond-no-ref__content" />
    </NodeViewWrapper>
  );
}

export function ReqGroupNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const { full: label } = useProcedureSectionHeading(props);
  const nodeName = props.node.type.name;
  const parentName = (() => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return "";
    const $pos = editor.state.doc.resolve(pos);
    return $pos.depth > 0 ? $pos.node($pos.depth).type.name : "";
  })();
  const isTableLikeGroup =
    nodeName === "reqSupportEquips" ||
    nodeName === "reqSupplies" ||
    nodeName === "reqSpares";
  const hideLabelInCloseRqmts =
    nodeName === "reqCondGroup" && parentName === "closeRqmts";
  const displayLabel = hideLabelInCloseRqmts ? "" : label;
  const reqCondAddLabel =
    parentName === "closeRqmts"
      ? "添加结束要求"
      : parentName === "preliminaryRqmts"
        ? "添加作业条件"
        : null;
  const showReqCondAddBtn =
    nodeName === "reqCondGroup" && reqCondAddLabel != null;

  const emptyPlaceholderAddLabel = (() => {
    const onlyChild = props.node.firstChild?.type.name;
    if (props.node.childCount !== 1 || !onlyChild) return null;
    if (onlyChild === "noSupportEquips") return "添加工装工具";
    if (onlyChild === "noSupplies") return "添加辅料";
    if (onlyChild === "noSpares") return "添加备件";
    if (onlyChild === "noSafety") return "添加安全要求";
    return null;
  })();

  const addReqCond = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!editor.isEditable) return;
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null) return;
      insertReqCondNoRefAtEnd(editor, pos);
      editor.commands.focus();
    },
    [editor, getPos],
  );

  const addEmptyPlaceholderContent = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!editor.isEditable) return;
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null) return;
      if (nodeName === "reqSafety") {
        openInsertAttentionChoiceModal(editor, {
          mode: "fromNoSafety",
          reqSafetyPos: pos,
        });
      } else if (
        nodeName === "reqSupportEquips" ||
        nodeName === "reqSupplies" ||
        nodeName === "reqSpares"
      ) {
        insertFirstEquipDescrGroupAtReq(
          editor,
          pos,
          nodeName as EquipReqContainerType,
        );
      }
      editor.commands.focus();
    },
    [editor, getPos, nodeName],
  );

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
      {!readOnly && (showReqCondAddBtn || emptyPlaceholderAddLabel) ? (
        <div className="s1000d-support-equip__toolbar" contentEditable={false}>
          {showReqCondAddBtn ? (
            <Button
              type="text"
              size="small"
              className="s1000d-support-equip__add-btn"
              icon={<Plus size={14} aria-hidden />}
              onMouseDown={(e) => e.preventDefault()}
              onClick={addReqCond}
            >
              {reqCondAddLabel}
            </Button>
          ) : null}
          {emptyPlaceholderAddLabel ? (
            <Button
              type="text"
              size="small"
              className="s1000d-support-equip__add-btn"
              icon={<Plus size={14} aria-hidden />}
              onMouseDown={(e) => e.preventDefault()}
              onClick={addEmptyPlaceholderContent}
            >
              {emptyPlaceholderAddLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

/** `safetyRqmts` 容器：子块 hover 提示由各自 attention NodeView 承担。 */
export function SafetyRqmtsNodeView(props: NodeViewProps) {
  void props;
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-procedure-safety-rqmts"
      data-s1000d-node="safetyRqmts"
    >
      <NodeViewContent className="s1000d-procedure-safety-rqmts__content" />
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
