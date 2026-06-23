import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";

const CONDITION_KIND_LABEL: Record<string, string> = {
  if: "如果",
  elseIf: "否则如果",
  case: "条件",
};

const CREW_CONDITION_NODE_NAMES = new Set(["if", "elseIf", "case"]);
const CREW_CONDITION_CHAIN_PARENTS = new Set(["crewDrillStep", "crewDrill"]);

type CrewConditionChainRole = "start" | "mid" | "end";

function resolveCrewConditionChainRole(
  props: NodeViewProps,
): CrewConditionChainRole | null {
  const { editor, getPos } = props;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return null;
  try {
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    if (!CREW_CONDITION_CHAIN_PARENTS.has(parent.type.name)) return null;

    const index = $pos.index();
    const isSiblingCondition = (i: number) =>
      CREW_CONDITION_NODE_NAMES.has(parent.child(i).type.name);

    const hasPrev = index > 0 && isSiblingCondition(index - 1);
    const hasNext =
      index < parent.childCount - 1 && isSiblingCondition(index + 1);

    if (!hasPrev && !hasNext) return null;
    if (!hasPrev && hasNext) return "start";
    if (hasPrev && hasNext) return "mid";
    return "end";
  } catch {
    return null;
  }
}

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
/** 操作卡片根容器 */
export function CrewRefCardNodeView(props: NodeViewProps) {
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="article"
      className="s1000d-crew-ref-card"
      data-s1000d-node="crewRefCard"
    >
      <NodeViewContent className="s1000d-crew-ref-card__content" />
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
  useNodeViewEditorState(props.editor);
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-crew-drill-step"
      data-s1000d-node="crewDrillStep"
    >
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
  const { node } = props;
  const { docVersion } = useNodeViewEditorState(props.editor);
  const kind = node.type.name;
  const chainRole = useMemo(
    () => resolveCrewConditionChainRole(props),
    [props, docVersion],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={[
        "s1000d-crew-condition",
        chainRole ? `s1000d-crew-condition--chain-${chainRole}` : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-s1000d-node={kind}
      data-s1000d-crew-cond-kind={kind}
      data-s1000d-crew-cond-chain={chainRole ?? undefined}
    >
      <NodeViewContent className="s1000d-crew-condition__content" />
    </NodeViewWrapper>
  );
}
