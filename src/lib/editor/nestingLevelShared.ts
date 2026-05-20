import type { ResolvedPos } from "@tiptap/pm/model";

export const LIST_ITEM = "listItem";
export const LEVELLED_PARA = "levelledPara";
export const LIST_TYPES = new Set(["bulletList", "orderedList"]);
export const WRAP_BLOCK_TYPES = new Set(["title", "para", "paragraph"]);

/** 与 `S1000DNodes` 中标题展示层级上限一致 */
export const TITLE_LEVEL_CAP = 6;

export function collectAncestorDepths(
  $from: ResolvedPos,
  typeName: string,
): number[] {
  const depths: number[] = [];
  for (let d = 0; d <= $from.depth; d++) {
    if ($from.node(d).type.name === typeName) depths.push(d);
  }
  return depths;
}

export function getInnermostLevelledParaDepth($from: ResolvedPos): number {
  let depth = -1;
  for (let d = 0; d <= $from.depth; d++) {
    if ($from.node(d).type.name === LEVELLED_PARA) depth = d;
  }
  return depth;
}

export function getListItemDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === LIST_ITEM) return d;
  }
  return -1;
}

/** 光标在列表项、列表块内，或紧邻列表块。 */
export function isInListNestingContext($from: ResolvedPos): boolean {
  if (getListItemDepth($from) >= 0) return true;
  for (let d = $from.depth; d >= 0; d--) {
    if (LIST_TYPES.has($from.node(d).type.name)) return true;
  }
  const nodeBefore = $from.nodeBefore;
  const nodeAfter = $from.nodeAfter;
  if (nodeBefore && LIST_TYPES.has(nodeBefore.type.name)) return true;
  if (nodeAfter && LIST_TYPES.has(nodeAfter.type.name)) return true;
  return false;
}

/** 光标是否位于 levelledPara 的 title/para（或其中段落）内。 */
export function isInLevelledParaTitleOrPara($from: ResolvedPos): boolean {
  const lpDepth = getInnermostLevelledParaDepth($from);
  if (lpDepth < 0 || $from.depth <= lpDepth) return false;

  for (let d = lpDepth + 1; d <= $from.depth; d++) {
    const name = $from.node(d).type.name;
    if (LIST_TYPES.has(name) || name === LIST_ITEM) return false;
    if (name === "figure" || name === "table" || name === "note") return false;
    if (name === "warning" || name === "caution") return false;
  }

  for (let d = $from.depth; d > lpDepth; d--) {
    if (WRAP_BLOCK_TYPES.has($from.node(d).type.name)) return true;
  }

  return false;
}
