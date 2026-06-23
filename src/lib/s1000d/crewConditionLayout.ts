import type { NodeViewProps } from "@tiptap/react";

export type CrewConditionChainRole = "start" | "mid" | "end";

const CONDITION_CONTAINER_NAMES = new Set(["if", "elseIf", "case"]);

function siblingName(
  parent: { child: (i: number) => { type: { name: string } }; childCount: number },
  index: number,
): string | null {
  if (index < 0 || index >= parent.childCount) return null;
  return parent.child(index).type.name;
}

function resolveChainRole(
  index: number,
  parent: { child: (i: number) => { type: { name: string } }; childCount: number },
  matches: (name: string | null) => boolean,
): CrewConditionChainRole | null {
  const hasPrev = matches(siblingName(parent, index - 1));
  const hasNext = matches(siblingName(parent, index + 1));

  if (!hasPrev && !hasNext) return null;
  if (!hasPrev && hasNext) return "start";
  if (hasPrev && hasNext) return "mid";
  return "end";
}

/** 同父节点下相邻 if / elseIf 自成链（中间可有 crewDrillStep、case 等隔开则不算相邻）。 */
function resolveIfElseIfChainRole(
  nodeName: string,
  index: number,
  parent: { child: (i: number) => { type: { name: string } }; childCount: number },
): CrewConditionChainRole | null {
  if (nodeName !== "if" && nodeName !== "elseIf") return null;
  return resolveChainRole(index, parent, (name) =>
    name === "if" || name === "elseIf",
  );
}

/** 同父节点下相邻 case 自成链。 */
function resolveCaseChainRole(
  nodeName: string,
  index: number,
  parent: { child: (i: number) => { type: { name: string } }; childCount: number },
): CrewConditionChainRole | null {
  if (nodeName !== "case") return null;
  return resolveChainRole(index, parent, (name) => name === "case");
}

export function resolveCrewConditionChainRole(
  props: NodeViewProps,
): CrewConditionChainRole | null {
  const { editor, getPos, node } = props;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return null;

  try {
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    const index = $pos.index();
    const nodeName = node.type.name;

    return (
      resolveIfElseIfChainRole(nodeName, index, parent) ??
      resolveCaseChainRole(nodeName, index, parent)
    );
  } catch {
    return null;
  }
}

/** 祖先中 if/elseIf/case 容器层数（不含自身），用于嵌套缩进。 */
export function resolveCrewConditionNestDepth(props: NodeViewProps): number {
  const { editor, getPos } = props;
  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return 0;

  try {
    const $pos = editor.state.doc.resolve(pos);
    let depth = 0;
    // $pos.node(d) for d === $pos.depth 为直接父级（外层 if 等），须计入
    for (let d = $pos.depth; d > 0; d--) {
      if (CONDITION_CONTAINER_NAMES.has($pos.node(d).type.name)) {
        depth += 1;
      }
    }
    return depth;
  } catch {
    return 0;
  }
}
