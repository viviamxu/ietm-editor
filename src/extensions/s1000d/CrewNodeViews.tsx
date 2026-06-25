import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Radio } from "@arco-design/web-react";
import { NodeSelection } from "@tiptap/pm/state";
import { Brackets } from "lucide-react";
import { useCallback, useMemo, useReducer, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  useImeSafeEditorSync,
  useNodeViewEditorState,
} from "../../hooks/useNodeViewEditorState";
import {
  resolveCrewConditionChainRole,
  resolveCrewConditionNestDepth,
} from "../../lib/s1000d/crewConditionLayout";
import {
  replaceCrewContentMode,
  resolveCrewContentMode,
  type CrewContentMode,
} from "../../lib/s1000d/crewModeSwitch";
import {
  getDescrCrewZoneLabel,
  type DescrCrewZone,
} from "../../lib/s1000d/descrCrewLayout";
import {
  insertDescrCrewZoneFromSchema,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { CrewConditionBlockMenu } from "./CrewConditionBlockMenu";

const CONDITION_KIND_LABEL: Record<string, string> = {
  if: "如果",
  elseIf: "否则如果",
  case: "条件",
};

function resolveCaseCondLabel(props: NodeViewProps): string {
  const { editor, getPos } = props;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return "条件";
  try {
    const $pos = editor.state.doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) {
      const name = $pos.node(d).type.name;
      const label = CONDITION_KIND_LABEL[name];
      if (label) return label;
    }
  } catch {
    /* ignore */
  }
  return "条件";
}

function selectionOnThisCrewCondition(props: NodeViewProps): {
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
    const name = $from.node(d).type.name;
    if (name === "if" || name === "elseIf" || name === "case") {
      return { nodeSelected: false, caretInside: $from.before(d) === pos };
    }
  }
  return { nodeSelected: false, caretInside: false };
}

function selectionOnThisCrewDrillStep(props: NodeViewProps): {
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
    if ($from.node(d).type.name === "crewDrillStep" && $from.before(d) === pos) {
      return { nodeSelected: false, caretInside: true };
    }
  }
  return { nodeSelected: false, caretInside: false };
}

const CREW_MODE_HEADING_LABEL: Record<CrewContentMode, string> = {
  crewRefCard: "操作卡片",
  descrCrew: "描述类操作",
};

/** `crewRefCard` / `descrCrew` 模式切换（悬浮于根容器顶栏）。 */
function CrewContentModeSwitcher(props: {
  editor: NodeViewProps["editor"];
  getPos: NodeViewProps["getPos"];
  activeMode: CrewContentMode;
}) {
  const { editor, getPos, activeMode } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const rootPosRef = useRef<number | null>(null);

  const captureRootPos = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos != null) rootPosRef.current = pos;
  }, [getPos]);

  const setMode = useCallback(
    (mode: CrewContentMode) => {
      if (readOnly) return;
      captureRootPos();
      replaceCrewContentMode(editor, mode, getDescriptionSchema());
    },
    [captureRootPos, editor, readOnly],
  );

  return (
    <div className="s1000d-crew-mode__head" contentEditable={false}>
      <span className="s1000d-crew-mode__heading">
        {CREW_MODE_HEADING_LABEL[activeMode]}
      </span>
      <div
        className="s1000d-crew-mode__kind-radio-wrap"
        onMouseDown={(e: ReactMouseEvent) => {
          e.preventDefault();
          captureRootPos();
        }}
      >
        <Radio.Group
          type="button"
          size="small"
          className="s1000d-crew-mode__kind-radio"
          value={activeMode}
          disabled={readOnly}
          onChange={(v) => setMode(v as CrewContentMode)}
        >
          <Radio value="crewRefCard">操作卡片</Radio>
          <Radio value="descrCrew">描述类操作</Radio>
        </Radio.Group>
      </div>
    </div>
  );
}

/** 操作卡片根容器 */
export function CrewRefCardNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  useNodeViewEditorState(editor);
  const activeMode = useMemo(
    () => resolveCrewContentMode(editor.state.doc),
    [editor.state.doc],
  );

  return (
    <NodeViewWrapper
      as="article"
      className="s1000d-crew-ref-card"
      data-s1000d-node="crewRefCard"
    >
      <CrewContentModeSwitcher
        editor={editor}
        getPos={getPos}
        activeMode={activeMode}
      />
      <NodeViewContent className="s1000d-crew-ref-card__content" />
    </NodeViewWrapper>
  );
}

const DESCR_CREW_ZONES: DescrCrewZone[] = [
  "warning",
  "caution",
  "note",
  // "levelledPara",
];

const DESCR_CREW_ZONE_HINT: Partial<Record<DescrCrewZone, string>> = {
  warning: "可插入多条警告，须位于最前",
  caution: "位于全部警告之后",
  note: "位于全部注意之后",
  // levelledPara: "位于全部注之后",
};

/** `descrCrew` 四段分区导航与快捷插入（顺序由 schema / 归一化插件保证）。 */
function DescrCrewZoneOutline(props: {
  editor: NodeViewProps["editor"];
}) {
  const { editor } = props;
  const { readOnly } = useNodeViewEditorState(editor);

  const addZone = useCallback(
    (zone: DescrCrewZone) => {
      if (readOnly) return;
      insertDescrCrewZoneFromSchema(editor, getDescriptionSchema(), zone);
    },
    [editor, readOnly],
  );

  return (
    <div className="s1000d-descr-crew__zones" contentEditable={false}>
      {DESCR_CREW_ZONES.map((zone) => (
        <div
          key={zone}
          className="s1000d-descr-crew__zone"
          data-s1000d-descr-crew-zone={zone}
        >
          <div className="s1000d-descr-crew__zone-head">
            <span className="s1000d-descr-crew__zone-label">
              {getDescrCrewZoneLabel(zone)}
            </span>
            <button
              type="button"
              className="s1000d-descr-crew__zone-add"
              disabled={readOnly}
              onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
              onClick={() => addZone(zone)}
            >
              添加
            </button>
          </div>
          <p className="s1000d-descr-crew__zone-hint">
            {DESCR_CREW_ZONE_HINT[zone]}
          </p>
        </div>
      ))}
    </div>
  );
}

/** 描述类操作根容器 */
export function DescrCrewNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  useNodeViewEditorState(editor);
  const activeMode = useMemo(
    () => resolveCrewContentMode(editor.state.doc),
    [editor.state.doc],
  );

  return (
    <NodeViewWrapper
      as="article"
      className="s1000d-descr-crew"
      data-s1000d-node="descrCrew"
    >
      <CrewContentModeSwitcher
        editor={editor}
        getPos={getPos}
        activeMode={activeMode}
      />
      <DescrCrewZoneOutline editor={editor} />
      <NodeViewContent className="s1000d-descr-crew__content" />
    </NodeViewWrapper>
  );
}

/** `crewDrill` 操作章节 */
export function CrewDrillNodeView(props: NodeViewProps) {
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="section"
      className="s1000d-crew-drill"
      data-s1000d-node="crewDrill"
    >
      <NodeViewContent className="s1000d-crew-drill__content" />
    </NodeViewWrapper>
  );
}

/** `crewDrillStep` 操作步骤 */
export function CrewDrillStepNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  useNodeViewEditorState(editor);
  const [hovered, setHovered] = useState(false);
  const [, bumpFromSelection] = useReducer((n: number) => n + 1, 0);
  useImeSafeEditorSync(editor, ["selectionUpdate"], bumpFromSelection);

  const { nodeSelected, caretInside } = selectionOnThisCrewDrillStep(props);
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
          ? "s1000d-crew-drill-step s1000d-crew-drill-step--chrome"
          : "s1000d-crew-drill-step"
      }
      data-s1000d-node="crewDrillStep"
      onMouseEnter={(e: ReactMouseEvent<HTMLDivElement>) => {
        const prev = e.relatedTarget;
        if (prev instanceof globalThis.Node && e.currentTarget.contains(prev)) {
          return;
        }
        setHovered(true);
      }}
      onMouseLeave={(e: ReactMouseEvent<HTMLDivElement>) => {
        const next = e.relatedTarget;
        if (next instanceof globalThis.Node && e.currentTarget.contains(next)) {
          return;
        }
        setHovered(false);
      }}
    >
      <button
        type="button"
        className="s1000d-crew-drill-step__block-handle"
        contentEditable={false}
        tabIndex={-1}
        aria-label="选中整块 crewDrillStep"
        title="选中整块"
        onMouseDown={selectWholeBlock}
      >
        <Brackets size={14} strokeWidth={2} aria-hidden />
      </button>
      <NodeViewContent className="s1000d-crew-drill-step__content" />
    </NodeViewWrapper>
  );
}

/** `challengeAndResponse` 检查/响应卡片 */
export function ChallengeAndResponseNodeView(props: NodeViewProps) {
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-crew-car"
      data-s1000d-node="challengeAndResponse"
    >
      <NodeViewContent className="s1000d-crew-car__content" />
    </NodeViewWrapper>
  );
}

/** `challenge` 行：前置「检查」标签 */
export function ChallengeRowNodeView(props: NodeViewProps) {
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-crew-car__row s1000d-crew-car__row--challenge"
      data-s1000d-node="challenge"
    >
      <span
        className="s1000d-crew-car__badge s1000d-crew-car__badge--check"
        contentEditable={false}
      >
        检查
      </span>
      <NodeViewContent className="s1000d-crew-car__row-body" />
    </NodeViewWrapper>
  );
}

/** `response` 行：前置「响应」标签 */
export function ResponseRowNodeView(props: NodeViewProps) {
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-crew-car__row s1000d-crew-car__row--response"
      data-s1000d-node="response"
    >
      <span
        className="s1000d-crew-car__badge s1000d-crew-car__badge--response"
        contentEditable={false}
      >
        响应
      </span>
      <NodeViewContent className="s1000d-crew-car__row-body" />
    </NodeViewWrapper>
  );
}

/** `caseCond` 行：前置「如果 / 否则如果 / 条件」标签 */
export function CaseCondNodeView(props: NodeViewProps) {
  const { docVersion } = useNodeViewEditorState(props.editor);
  const label = useMemo(
    () => resolveCaseCondLabel(props),
    [props, docVersion],
  );

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-crew-case-cond"
      data-s1000d-node="caseCond"
    >
      <span
        className="s1000d-crew-condition__badge"
        contentEditable={false}
      >
        {label}
      </span>
      <NodeViewContent className="s1000d-crew-case-cond__text" />
    </NodeViewWrapper>
  );
}

/** `if` / `elseIf` / `case` 条件分支 */
export function CrewConditionNodeView(props: NodeViewProps) {
  const { node, editor, getPos } = props;
  const { docVersion } = useNodeViewEditorState(editor);
  const [, bumpFromSelection] = useReducer(
    (n: number) => n + 1,
    0,
  );
  useImeSafeEditorSync(editor, ["selectionUpdate", "update"], bumpFromSelection);

  const kind = node.type.name;
  const blockLabel = CONDITION_KIND_LABEL[kind] ?? "条件";
  const chainRole = useMemo(
    () => resolveCrewConditionChainRole(props),
    [props, docVersion],
  );
  const nestDepth = useMemo(
    () => resolveCrewConditionNestDepth(props),
    [props, docVersion],
  );
  const { nodeSelected, caretInside } = selectionOnThisCrewCondition(props);
  const showChrome = caretInside || nodeSelected;

  return (
    <NodeViewWrapper
      as="div"
      className={[
        "s1000d-crew-condition",
        showChrome ? "s1000d-crew-condition--chrome" : null,
        chainRole ? `s1000d-crew-condition--chain-${chainRole}` : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node={kind}
      data-s1000d-crew-cond-kind={kind}
      data-s1000d-crew-cond-chain={chainRole ?? undefined}
      data-s1000d-crew-cond-depth={nestDepth}
      style={
        {
          "--s1000d-crew-cond-depth": nestDepth,
        } as CSSProperties
      }
    >
      <CrewConditionBlockMenu
        editor={editor}
        getPos={getPos}
        kind={kind}
        blockLabel={blockLabel}
      />
      <NodeViewContent className="s1000d-crew-condition__content" />
    </NodeViewWrapper>
  );
}
