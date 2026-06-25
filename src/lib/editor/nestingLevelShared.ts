import type { ResolvedPos } from "@tiptap/pm/model";

export const LIST_ITEM = "listItem";
export const LEVELLED_PARA = "levelledPara";
export const PROCEDURAL_STEP = "proceduralStep";
export const CREW_DRILL_STEP = "crewDrillStep";
export const CREW_CONDITION_TYPES = new Set(["if", "elseIf", "case"]);
export const LIST_TYPES = new Set(["bulletList", "orderedList"]);
export const WRAP_BLOCK_TYPES = new Set(["title", "para", "paragraph"]);

const STEP_NESTING_BLOCK_TYPES = new Set([
  "figure",
  "table",
  "note",
  "warning",
  "caution",
]);

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

export function getInnermostProceduralStepDepth($from: ResolvedPos): number {
  let depth = -1;
  for (let d = 0; d <= $from.depth; d++) {
    if ($from.node(d).type.name === PROCEDURAL_STEP) depth = d;
  }
  return depth;
}

export function getInnermostCrewDrillStepDepth($from: ResolvedPos): number {
  let depth = -1;
  for (let d = 0; d <= $from.depth; d++) {
    if ($from.node(d).type.name === CREW_DRILL_STEP) depth = d;
  }
  return depth;
}

export function getListItemDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === LIST_ITEM) return d;
  }
  return -1;
}

export type ListItemInListContext = {
  listFrom: number;
  itemIndex: number;
  listDepth: number;
  itemDepth: number;
};

/**
 * 解析光标所在的最内层 listItem 及其外层 ordered/bullet 列表。
 * 用 `from` 落在哪个 listItem 子树内计算下标，避免部分文档结构下 `$.index(d)` 与真实项不一致。
 */
export function resolveListItemInList(
  $pos: ResolvedPos,
): ListItemInListContext | null {
  const from = $pos.pos;

  for (let itemDepth = $pos.depth; itemDepth > 0; itemDepth--) {
    if ($pos.node(itemDepth).type.name !== LIST_ITEM) continue;
    const listDepth = itemDepth - 1;
    if (!LIST_TYPES.has($pos.node(listDepth).type.name)) continue;

    const listNode = $pos.node(listDepth);
    const listFrom = $pos.before(listDepth);
    const itemNode = $pos.node(itemDepth);

    let offset = 1;
    for (let i = 0; i < listNode.childCount; i++) {
      const child = listNode.child(i);
      const childStart = listFrom + offset;
      const childEnd = childStart + child.nodeSize;
      offset += child.nodeSize;

      if (child === itemNode || (from >= childStart && from < childEnd)) {
        return { listFrom, itemIndex: i, listDepth, itemDepth };
      }
    }
  }

  return null;
}

/** 已知 listItem 深度时，解析其在父级列表中的下标（与 {@link resolveListItemInList} 同一套位置算法）。 */
export function listItemIndexInParentList(
  $pos: ResolvedPos,
  itemDepth: number,
): number {
  if (itemDepth <= 0 || $pos.node(itemDepth).type.name !== LIST_ITEM) {
    return $pos.index(itemDepth);
  }
  const listDepth = itemDepth - 1;
  if (!LIST_TYPES.has($pos.node(listDepth).type.name)) {
    return $pos.index(itemDepth);
  }

  const listNode = $pos.node(listDepth);
  const listFrom = $pos.before(listDepth);
  const itemNode = $pos.node(itemDepth);
  const from = $pos.pos;

  let offset = 1;
  for (let i = 0; i < listNode.childCount; i++) {
    const child = listNode.child(i);
    const childStart = listFrom + offset;
    const childEnd = childStart + child.nodeSize;
    offset += child.nodeSize;

    if (child === itemNode || (from >= childStart && from < childEnd)) {
      return i;
    }
  }

  return $pos.index(itemDepth);
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

function isInHostBlockTitleOrPara(
  $from: ResolvedPos,
  hostDepth: number,
  excludedBlocks: ReadonlySet<string>,
): boolean {
  if (hostDepth < 0 || $from.depth <= hostDepth) return false;

  for (let d = hostDepth + 1; d <= $from.depth; d++) {
    const name = $from.node(d).type.name;
    if (LIST_TYPES.has(name) || name === LIST_ITEM) return false;
    if (excludedBlocks.has(name)) return false;
  }

  for (let d = $from.depth; d > hostDepth; d--) {
    if (WRAP_BLOCK_TYPES.has($from.node(d).type.name)) return true;
  }

  return false;
}

/** 光标是否位于 levelledPara 的 title/para（或其中段落）内。 */
export function isInLevelledParaTitleOrPara($from: ResolvedPos): boolean {
  return isInHostBlockTitleOrPara(
    $from,
    getInnermostLevelledParaDepth($from),
    STEP_NESTING_BLOCK_TYPES,
  );
}

/** 光标是否位于 proceduralStep 的 title/para（或其中段落）内。 */
export function isInProceduralStepTitleOrPara($from: ResolvedPos): boolean {
  return isInHostBlockTitleOrPara(
    $from,
    getInnermostProceduralStepDepth($from),
    STEP_NESTING_BLOCK_TYPES,
  );
}

/** 光标是否位于 crewDrillStep 的 title/para（或其中段落）内。 */
export function isInCrewDrillStepTitleOrPara($from: ResolvedPos): boolean {
  return isInHostBlockTitleOrPara(
    $from,
    getInnermostCrewDrillStepDepth($from),
    new Set([...STEP_NESTING_BLOCK_TYPES, "challengeAndResponse"]),
  );
}
