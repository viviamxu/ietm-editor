import type { Node as PMNode } from "@tiptap/pm/model";

import type {
  ProcedureNumberingConfig,
  ProcedureOutlineEntry,
  ProcedureSectionHeading,
  ProcedureUiConfig,
} from "../../types/procedureUiConfig";

export function formatProcedureSectionNumber(
  segments: readonly number[],
  numbering: ProcedureNumberingConfig,
): string {
  if (segments.length === 0) return "";
  const core = segments.join(numbering.separator);
  return numbering.suffix ? `${core}${numbering.suffix}` : core;
}

function resolveLabelFromOutline(
  outline: ProcedureOutlineEntry[],
  path: readonly string[],
): string {
  let level = outline;
  let label = "";
  for (const nodeName of path) {
    const entry = level.find((e) => e.node === nodeName);
    if (!entry) break;
    label = entry.label;
    level = entry.children ?? [];
  }
  return label;
}

export const PROCEDURAL_STEP = "proceduralStep";

/** 含 `title` 的 `proceduralStep` 在文档中的起始位置；非步骤标题则返回 `null`。 */
export function findProceduralStepPosForTitle(
  doc: PMNode,
  titlePos: number,
): number | null {
  try {
    const $pos = doc.resolve(titlePos + 1);
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === PROCEDURAL_STEP) {
        return $pos.before(d);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function proceduralStepIndexInParent(
  parent: PMNode,
  childNode: PMNode,
): number {
  let index = 0;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child.type.name !== PROCEDURAL_STEP) continue;
    index++;
    if (child === childNode) return index;
  }
  return index > 0 ? index : 1;
}

/**
 * 与 `computeLevelledParaSectionPath` 同逻辑：沿祖先收集各级 `proceduralStep`
 * 在同级中的序号（1-based），不依赖大纲 `children` 深度。
 */
export function computeProceduralStepSectionPath(
  doc: PMNode,
  pos: number,
  nodeType?: string,
): number[] {
  try {
    const $pos = resolveProcedureNodePos(doc, pos, nodeType);
    const path: number[] = [];
    for (let d = 1; d <= $pos.depth; d++) {
      if ($pos.node(d).type.name !== PROCEDURAL_STEP) continue;
      const parent = $pos.node(d - 1);
      const stepNode = $pos.node(d);
      const index = proceduralStepIndexInParent(parent, stepNode);
      if (index > 0) path.push(index);
    }
    return path;
  } catch {
    return [];
  }
}

/** 大纲固定节（`mainProcedure` 等）的前缀段；可重复的 `proceduralStep` 由 {@link computeProceduralStepSectionPath} 计数。 */
function computeOutlinePrefixSegments(
  doc: PMNode,
  pos: number,
  outline: ProcedureOutlineEntry[],
  nodeType?: string,
): number[] {
  const $pos = resolveProcedureNodePos(doc, pos, nodeType);
  const segments: number[] = [];
  let outlineLevel = outline;

  for (let d = 1; d <= $pos.depth; d++) {
    const nodeName = $pos.node(d).type.name;
    if (nodeName === "doc" || nodeName === PROCEDURAL_STEP) continue;

    const entryIndex = outlineLevel.findIndex((e) => e.node === nodeName);
    if (entryIndex < 0) continue;

    const entry = outlineLevel[entryIndex]!;
    if (!entry.repeatable) {
      segments.push(entryIndex + 1);
    }
    outlineLevel = entry.children ?? [];
  }

  return segments;
}

/**
 * NodeView 的 `getPos()` 在节点起始边界；`resolve(pos)` 只含祖先。
 * 若 `nodeAfter` 与目标类型一致，则解析到节点内部以包含自身。
 */
function resolveProcedureNodePos(
  doc: PMNode,
  pos: number,
  nodeType?: string,
) {
  const $before = doc.resolve(pos);
  const after = $before.nodeAfter;
  if (
    after &&
    after.isBlock &&
    (!nodeType || after.type.name === nodeType)
  ) {
    return doc.resolve(Math.min(pos + 1, doc.content.size));
  }
  return $before;
}

/**
 * 程序类编号：大纲固定节前缀 + `proceduralStep` 嵌套序号（与 `levelledPara` 同级计数一致）。
 */
export function computeProcedureSectionNumberSegments(
  doc: PMNode,
  pos: number,
  outline: ProcedureOutlineEntry[],
  nodeType?: string,
): number[] {
  return [
    ...computeOutlinePrefixSegments(doc, pos, outline, nodeType),
    ...computeProceduralStepSectionPath(doc, pos, nodeType),
  ];
}

export function getProcedureNodePath(
  doc: PMNode,
  pos: number,
  nodeType?: string,
): string[] {
  const $pos = resolveProcedureNodePos(doc, pos, nodeType);
  const path: string[] = [];
  for (let d = 1; d <= $pos.depth; d++) {
    const name = $pos.node(d).type.name;
    if (name !== "doc") path.push(name);
  }
  return path;
}

export function resolveProcedureSectionHeading(
  doc: PMNode,
  pos: number,
  config: ProcedureUiConfig,
  nodeType?: string,
): ProcedureSectionHeading {
  const path = getProcedureNodePath(doc, pos, nodeType);
  const label = resolveLabelFromOutline(config.procedureOutline, path);
  if (!label) {
    return { number: "", label: "", full: "" };
  }

  const segments = computeProcedureSectionNumberSegments(
    doc,
    pos,
    config.procedureOutline,
    nodeType,
  );
  const number = config.numbering.enabled
    ? formatProcedureSectionNumber(segments, config.numbering)
    : "";
  const full = number ? `${number} ${label}` : label;

  return { number, label, full };
}
