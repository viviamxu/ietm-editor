import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Button, Radio, Select } from "@arco-design/web-react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { getDefaultTitleForIsolationBlock } from "../../lib/s1000d/faultIsolationDefaultTitles";
import {
  collectIsolationStepRefs,
  findChildNodePos,
  type IsolationStepRefOption,
} from "../../lib/s1000d/faultIsolationStepRefs";
import {
  buildMinimalChoiceJson,
  replaceIsolationStepAnswerKind,
} from "../../lib/s1000d/faultIsolationInsert";

function useEditorRefresh(editor: NodeViewProps["editor"]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const on = () => bump();
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
  return bump;
}

function readFaultCodeFromProcedure(node: PMNode): string {
  let code = "";
  node.forEach((child) => {
    if (child.type.name === "fault") {
      code = String(child.attrs.faultCode ?? "").trim();
    }
  });
  return code;
}

function ensureChildTitle(
  editor: NodeViewProps["editor"],
  getPos: NodeViewProps["getPos"],
  node: PMNode,
  blockType: "isolationStep" | "isolationProcedureEnd",
): void {
  let hasTitle = false;
  node.forEach((c) => {
    if (c.type.name === "title") hasTitle = true;
  });
  if (hasTitle) return;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return;
  const defaultLabel = getDefaultTitleForIsolationBlock(
    editor.state.doc,
    pos,
    blockType,
  );
  editor
    .chain()
    .insertContentAt(pos + 1, {
      type: "title",
      content: [{ type: "text", text: defaultLabel }],
    })
    .run();
}

function NextActionSelect({
  value,
  options,
  disabled,
  onChange,
  className,
}: {
  value: string;
  options: IsolationStepRefOption[];
  disabled?: boolean;
  onChange: (nextId: string) => void;
  className?: string;
}) {
  return (
    <Select
      className={["s1000d-fault-next-select", className].filter(Boolean).join(" ")}
      size="small"
      disabled={disabled}
      placeholder="选择下一步"
      value={value || undefined}
      onChange={(v) => onChange(String(v ?? ""))}
      triggerProps={{ autoAlignPopupWidth: false }}
    >
      {options.map((opt) => (
        <Select.Option key={opt.id} value={opt.id}>
          {opt.label}
        </Select.Option>
      ))}
    </Select>
  );
}

/** `faultIsolationProcedure`：顶栏故障码、故障描述、隔离步骤区。 */
export function FaultIsolationProcedureNodeView(props: NodeViewProps) {
  const { editor, getPos, node, HTMLAttributes } = props;
  const [collapsed, setCollapsed] = useState(false);
  useEditorRefresh(editor);

  const faultCode = readFaultCodeFromProcedure(node);

  const updateFaultCode = useCallback(
    (code: string) => {
      const base = typeof getPos === "function" ? getPos() : undefined;
      if (base == null) return;
      const faultPos = findChildNodePos(base, node, "fault");
      if (faultPos == null) return;
      const { tr } = editor.state;
      editor.view.dispatch(
        tr.setNodeMarkup(faultPos, undefined, {
          ...editor.state.doc.nodeAt(faultPos)?.attrs,
          faultCode: code,
        }),
      );
    },
    [editor, getPos, node],
  );

  return (
    <NodeViewWrapper
      as="section"
      {...HTMLAttributes}
      className={[
        HTMLAttributes?.class,
        "s1000d-fault-procedure",
        collapsed ? "s1000d-fault-procedure--collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="faultIsolationProcedure"
    >
      <header className="s1000d-fault-procedure__header">
        <button
          type="button"
          className="s1000d-fault-procedure__collapse"
          contentEditable={false}
          onClick={() => setCollapsed((c: boolean) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden />
          ) : (
            <ChevronDown size={16} aria-hidden />
          )}
        </button>
        <input
          type="text"
          className="s1000d-fault-procedure__code-input"
          contentEditable={false}
          value={faultCode}
          placeholder="故障代码"
          onChange={(e) => updateFaultCode(e.target.value)}
        />
      </header>
      {!collapsed ? (
        <>
          <div className="s1000d-fault-procedure__meta-group">
            <div className="s1000d-fault-procedure__meta-row">
              <span className="s1000d-fault-procedure__meta-label">
                故障代码：
              </span>
              <span className="s1000d-fault-procedure__meta-value">
                {faultCode || "—"}
              </span>
            </div>
            <NodeViewContent className="s1000d-fault-procedure__content" />
          </div>
        </>
      ) : null}
    </NodeViewWrapper>
  );
}

/**
 * `faultDescr`：与「故障代码」同级的「故障描述」行，正文来自子节点 `descr`。
 */
export function FaultDescrNodeView(props: NodeViewProps) {
  const { HTMLAttributes } = props;
  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      className={[
        HTMLAttributes?.class,
        "s1000d-fault-procedure__meta-row",
        "s1000d-fault-procedure__meta-row--fault-descr",
      ]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="faultDescr"
    >
      <span className="s1000d-fault-procedure__meta-label">故障描述：</span>
      <span className="s1000d-fault-procedure__meta-value">
        <NodeViewContent className="s1000d-fault-procedure__descr-content" />
      </span>
    </NodeViewWrapper>
  );
}

/** `isolationProcedure`：隔离步骤标题 + 步骤列表。 */
export function IsolationProcedureNodeView(props: NodeViewProps) {
  const { HTMLAttributes } = props;
  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      className={[
        HTMLAttributes?.class,
        "s1000d-fault-procedure__steps-section",
      ]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="isolationProcedure"
    >
      <div
        className="s1000d-fault-procedure__steps-heading"
        contentEditable={false}
      >
        隔离步骤
      </div>
      <NodeViewContent className="s1000d-fault-procedure__steps-content" />
    </NodeViewWrapper>
  );
}

/** `isolationStep`：步骤标题 + 动作/问题/答案分区。 */
export function IsolationStepNodeView(props: NodeViewProps) {
  const { editor, getPos, node, HTMLAttributes } = props;
  useEditorRefresh(editor);

  useEffect(() => {
    ensureChildTitle(editor, getPos, node, "isolationStep");
  }, [editor, getPos, node]);

  return (
    <NodeViewWrapper
      as="section"
      {...HTMLAttributes}
      className={[HTMLAttributes?.class, "s1000d-isolation-step"]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="isolationStep"
      data-s1000d-element-id={node.attrs.id ?? undefined}
    >
      <NodeViewContent className="s1000d-isolation-step__content" />
    </NodeViewWrapper>
  );
}

/** `isolationProcedureEnd`：结束标题 + 动作。 */
export function IsolationProcedureEndNodeView(props: NodeViewProps) {
  const { editor, getPos, node, HTMLAttributes } = props;
  useEditorRefresh(editor);

  useEffect(() => {
    ensureChildTitle(editor, getPos, node, "isolationProcedureEnd");
  }, [editor, getPos, node]);

  return (
    <NodeViewWrapper
      as="section"
      {...HTMLAttributes}
      className={[HTMLAttributes?.class, "s1000d-isolation-end"]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="isolationProcedureEnd"
      data-s1000d-element-id={node.attrs.id ?? undefined}
    >
      <NodeViewContent className="s1000d-isolation-end__content" />
    </NodeViewWrapper>
  );
}

/** `action` / `isolationStepQuestion` 字段标签 + 灰框内容区。 */
export function IsolationLabeledFieldNodeView(
  props: NodeViewProps & { label: string },
) {
  const { label, HTMLAttributes } = props;
  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      className={[HTMLAttributes?.class, "s1000d-fault-field"]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-field={props.node.type.name}
    >
      <div className="s1000d-fault-field__label">{label}</div>
      <div className="s1000d-fault-field__box">
        <NodeViewContent className="s1000d-fault-field__content" />
      </div>
    </NodeViewWrapper>
  );
}

export function IsolationActionNodeView(props: NodeViewProps) {
  return <IsolationLabeledFieldNodeView {...props} label="动作" />;
}

export function IsolationStepQuestionNodeView(props: NodeViewProps) {
  return <IsolationLabeledFieldNodeView {...props} label="问题" />;
}

/** `yesNoAnswer` 是/否 UI（由 `isolationStepAnswer` 承载，避免嵌套 NodeView 切换残留）。 */
function YesNoAnswerFields({
  editor,
  yesNoNode,
  yesNoPos,
}: {
  editor: NodeViewProps["editor"];
  yesNoNode: PMNode;
  yesNoPos: number;
}) {
  useEditorRefresh(editor);

  const stepOptions = useMemo(
    () => collectIsolationStepRefs(editor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor.state.doc],
  );

  let yesPos: number | null = null;
  let noPos: number | null = null;
  let yesRef = "";
  let noRef = "";
  let offset = 1;
  yesNoNode.forEach((child) => {
    if (child.type.name === "yesAnswer") {
      yesPos = yesNoPos + offset;
      yesRef = String(child.attrs.nextActionRefId ?? "").trim();
    } else if (child.type.name === "noAnswer") {
      noPos = yesNoPos + offset;
      noRef = String(child.attrs.nextActionRefId ?? "").trim();
    }
    offset += child.nodeSize;
  });

  const setRef = useCallback(
    (pos: number | null, refId: string) => {
      if (pos == null) return;
      const cur = editor.state.doc.nodeAt(pos);
      if (!cur) return;
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(pos, undefined, {
          ...cur.attrs,
          nextActionRefId: refId,
        }),
      );
    },
    [editor],
  );

  return (
    <div className="s1000d-fault-yesno" data-s1000d-node="yesNoAnswer">
      <div className="s1000d-fault-yesno__row">
        <span className="s1000d-fault-yesno__choice-label">是</span>
        <span className="s1000d-fault-yesno__next-label">下一步：</span>
        <NextActionSelect
          className="s1000d-fault-yesno__select"
          value={yesRef}
          options={stepOptions}
          onChange={(v) => setRef(yesPos, v)}
        />
      </div>
      <div className="s1000d-fault-yesno__row">
        <span className="s1000d-fault-yesno__choice-label">否</span>
        <span className="s1000d-fault-yesno__next-label">下一步：</span>
        <NextActionSelect
          className="s1000d-fault-yesno__select"
          value={noRef}
          options={stepOptions}
          onChange={(v) => setRef(noPos, v)}
        />
      </div>
    </div>
  );
}

/** `isolationStepAnswer`：是否 / 选择 Tab。 */
export function IsolationStepAnswerNodeView(props: NodeViewProps) {
  const { editor, getPos, node } = props;
  useEditorRefresh(editor);
  const answerPosRef = useRef<number | null>(null);

  const activeAnswerTab: "yesNo" | "choices" =
    node.firstChild?.type.name === "listOfChoices" ? "choices" : "yesNo";

  const yesNoChild =
    node.firstChild?.type.name === "yesNoAnswer" ? node.firstChild : null;

  const captureAnswerPos = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos != null) answerPosRef.current = pos;
  }, [getPos]);

  const setAnswerKind = useCallback(
    (kind: "yesNo" | "choices") => {
      const pos =
        answerPosRef.current ??
        (typeof getPos === "function" ? getPos() : undefined);
      if (pos == null) return;
      replaceIsolationStepAnswerKind(editor, pos, kind);
    },
    [editor, getPos],
  );

  const answerPos = typeof getPos === "function" ? getPos() : undefined;
  const yesNoPos = answerPos != null ? answerPos + 1 : null;

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-fault-answer"
      data-s1000d-node="isolationStepAnswer"
    >
      <div className="s1000d-fault-answer__head">
        <span className="s1000d-fault-answer__heading">答案选项</span>
        <div
          className="s1000d-fault-answer__kind-radio-wrap"
          contentEditable={false}
          onMouseDown={(e: ReactMouseEvent) => {
            e.preventDefault();
            captureAnswerPos();
          }}
        >
          <Radio.Group
            type="button"
            size="small"
            className="s1000d-fault-answer__kind-radio"
            value={activeAnswerTab}
            onChange={(v) => setAnswerKind(v as "yesNo" | "choices")}
          >
            <Radio value="yesNo">是否</Radio>
            <Radio value="choices">选择</Radio>
          </Radio.Group>
        </div>
      </div>
      {activeAnswerTab === "yesNo" && yesNoChild && yesNoPos != null ? (
        <YesNoAnswerFields
          editor={editor}
          yesNoNode={yesNoChild}
          yesNoPos={yesNoPos}
        />
      ) : null}
      <NodeViewContent
        className={[
          "s1000d-fault-answer__content",
          activeAnswerTab === "yesNo" ? "s1000d-fault-answer__content--yesno" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </NodeViewWrapper>
  );
}

/** `listOfChoices`：选项列表 + 添加选项。 */
export function ListOfChoicesNodeView(props: NodeViewProps) {
  const { editor, getPos, node, HTMLAttributes } = props;
  useEditorRefresh(editor);

  const addChoice = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return;
    const insertPos = pos + node.nodeSize - 1;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, buildMinimalChoiceJson())
      .run();
  }, [editor, getPos, node.nodeSize]);

  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      className={[HTMLAttributes?.class, "s1000d-fault-choices-list"]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="listOfChoices"
    >
      <NodeViewContent className="s1000d-fault-choices-list__items" />
      <div className="s1000d-fault-choices-list__add" contentEditable={false}>
        <Button
          type="text"
          size="small"
          onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
          onClick={addChoice}
        >
          + 添加选项
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

/** `listOfChoices` 内单条 `choice`：输入框 + 下一步下拉 + 删除。 */
export function ChoiceNodeView(props: NodeViewProps) {
  const { editor, getPos, node, HTMLAttributes } = props;
  useEditorRefresh(editor);

  const stepOptions = useMemo(
    () => collectIsolationStepRefs(editor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor.state.doc],
  );

  const refId = String(node.attrs.nextActionRefId ?? "").trim();

  const canDelete = useMemo(() => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return false;
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    return parent.type.name === "listOfChoices" && parent.childCount > 1;
  }, [editor, getPos, node]);

  const updateRef = useCallback(
    (nextId: string) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos == null) return;
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          nextActionRefId: nextId,
        }),
      );
    },
    [editor, getPos, node.attrs],
  );

  const deleteChoice = useCallback(() => {
    if (!canDelete) return;
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos == null) return;
    const cur = editor.state.doc.nodeAt(pos);
    if (!cur) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + cur.nodeSize })
      .run();
  }, [canDelete, editor, getPos]);

  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      className={[HTMLAttributes?.class, "s1000d-fault-choice"]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node="choice"
    >
      <div className="s1000d-fault-choice__text">
        <NodeViewContent className="s1000d-fault-choice__content" />
      </div>
      <div className="s1000d-fault-choice__next" contentEditable={false}>
        <NextActionSelect
          value={refId}
          options={stepOptions}
          onChange={updateRef}
        />
      </div>
      <button
        type="button"
        className="s1000d-fault-choice__delete"
        contentEditable={false}
        disabled={!canDelete}
        title={canDelete ? "删除此选项" : "至少保留一个选项"}
        onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
        onClick={deleteChoice}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </NodeViewWrapper>
  );
}

/** 隐藏原子 `yesAnswer` / `noAnswer` 的默认占位。 */
export function HiddenAtomNodeView() {
  return <NodeViewWrapper as="span" className="s1000d-fault-atom-hidden" />;
}

/** 隐藏 `fault` 空元素占位。 */
export function HiddenFaultNodeView() {
  return <NodeViewWrapper as="span" className="s1000d-fault-atom-hidden" />;
}
