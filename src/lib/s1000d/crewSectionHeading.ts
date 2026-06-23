import type { Node as PMNode } from "@tiptap/pm/model";

export const CREW_DRILL = "crewDrill";
export const CREW_DRILL_STEP = "crewDrillStep";
export const CREW_REF_CARD = "crewRefCard";

const CREW_CONDITION_TYPES = new Set(["if", "elseIf", "case"]);

const TITLE_CAPTION_PARENT_TYPES = new Set(["figure", "table", "multimedia"]);

export function crewDrillIndexInParent(
  parent: PMNode,
  childNode: PMNode,
): number {
  let index = 0;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child.type.name !== CREW_DRILL) continue;
    index++;
    if (child === childNode) return index;
  }
  return index > 0 ? index : 1;
}

export function crewDrillStepIndexInParent(
  parent: PMNode,
  childNode: PMNode,
): number {
  let index = 0;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child.type.name !== CREW_DRILL_STEP) continue;
    index++;
    if (child === childNode) return index;
  }
  return index > 0 ? index : 1;
}

/** 从 `title` 位置向上判断是否在 `if` / `elseIf` / `case` 内。 */
export function isCrewTitleInsideCondition(doc: PMNode, titlePos: number): boolean {
  try {
    const $pos = doc.resolve(titlePos + 1);
    for (let d = $pos.depth; d > 0; d--) {
      if (CREW_CONDITION_TYPES.has($pos.node(d).type.name)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** `title` 是否属于操作类章节标题（非图题/表题；不含 if/elseIf/case 内）。 */
export function isCrewSectionTitle(doc: PMNode, titlePos: number): boolean {
  if (isCrewTitleInsideCondition(doc, titlePos)) return false;
  try {
    const $pos = doc.resolve(titlePos + 1);
    let titleDepth = -1;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === "title") {
        titleDepth = d;
        break;
      }
    }
    if (titleDepth < 0) return false;
    const parentType = $pos.node(titleDepth - 1).type.name;
    if (TITLE_CAPTION_PARENT_TYPES.has(parentType)) return false;
    if (parentType === CREW_DRILL || parentType === CREW_DRILL_STEP) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * 操作类章节序号路径。
 * - `crewDrill` 下 title → `[1]` → `1.`
 * - 嵌套 `crewDrillStep` → `[1, 1, 2]` → `1.1.2.`
 * - `if` / `elseIf` / `case` 内 title 不参与编号（见 {@link isCrewSectionTitle}）
 */
export function computeCrewSectionNumberPath(
  doc: PMNode,
  titlePos: number,
): number[] {
  if (isCrewTitleInsideCondition(doc, titlePos)) return [];
  try {
    const $pos = doc.resolve(titlePos + 1);
    const path: number[] = [];

    let titleParent: string | null = null;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === "title") {
        titleParent = $pos.node(d - 1).type.name;
        break;
      }
    }

    for (let d = 1; d <= $pos.depth; d++) {
      const name = $pos.node(d).type.name;
      if (name === CREW_DRILL) {
        const parent = $pos.node(d - 1);
        const drillNode = $pos.node(d);
        const index = crewDrillIndexInParent(parent, drillNode);
        if (index > 0) path.push(index);
      }
      if (name === CREW_DRILL_STEP) {
        const parent = $pos.node(d - 1);
        const stepNode = $pos.node(d);
        const index = crewDrillStepIndexInParent(parent, stepNode);
        if (index > 0) path.push(index);
      }
    }

    if (titleParent === CREW_DRILL && path.length > 1) {
      return [path[0]!];
    }

    return path;
  } catch {
    return [];
  }
}

/** 将路径格式化为展示序号（如 `1.`、`1.1.`）。 */
export function formatCrewSectionNumber(path: readonly number[]): string {
  if (path.length === 0) return "";
  return `${path.join(".")}.`;
}

/** `if` / `elseIf` / `case` 内 `crewDrillStep` 的 `title`（使用 `1)` 编号，非层级 `1.1.`）。 */
export function isCrewConditionStepTitle(
  doc: PMNode,
  titlePos: number,
): boolean {
  if (!isCrewTitleInsideCondition(doc, titlePos)) return false;
  try {
    const $pos = doc.resolve(titlePos + 1);
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name !== "title") continue;
      return $pos.node(d - 1).type.name === CREW_DRILL_STEP;
    }
  } catch {
    return false;
  }
  return false;
}

/** 同一条件块内 `crewDrillStep` 的 1-based 序号，格式 `1)`、`2)`。 */
export function computeCrewConditionStepNumber(
  doc: PMNode,
  titlePos: number,
): string | null {
  try {
    const $pos = doc.resolve(titlePos + 1);
    let stepDepth = -1;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === CREW_DRILL_STEP) {
        stepDepth = d;
        break;
      }
    }
    if (stepDepth < 0) return null;

    const parent = $pos.node(stepDepth - 1);
    if (!CREW_CONDITION_TYPES.has(parent.type.name)) return null;

    const index = crewDrillStepIndexInParent(parent, $pos.node(stepDepth));
    return index > 0 ? `${index})` : null;
  } catch {
    return null;
  }
}
