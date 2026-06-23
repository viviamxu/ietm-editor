import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { getDmContentKind } from "./dmContentKind";

const LOOSE_PARA_TYPES = new Set(["para", "paragraph"]);

const ATTENTION_TYPES = new Set(["warning", "caution", "note"]);

const FMFT_TYPES = new Set(["figure", "multimedia", "table"]);

/** 编辑器专用节点 → schema content token */
const EDITOR_NODE_TO_TOKENS: Record<string, string[]> = {
  catalogSeqNumberGroup: ["catalogSeqNumber"],
  bulletList: ["randomList", "listElemGroup"],
  orderedList: ["sequentialList", "listElemGroup"],
  paragraph: ["para"],
};

type ContentSegment = {
  alternatives: string[];
  quantifier: "+" | "*" | "?" | "";
};

function parseContentSegments(rule: string): ContentSegment[] {
  const trimmed = rule.trim();
  if (!trimmed) return [];

  const segments: ContentSegment[] = [];
  const re = /(\([^)]+\)[*+?]?|[^\s()]+[*+?]?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const raw = m[1];
    const quantMatch = raw.match(/([*+?])$/);
    const quantifier = (quantMatch?.[1] ?? "") as ContentSegment["quantifier"];
    const core = quantMatch ? raw.slice(0, -1) : raw;

    if (core.startsWith("(") && core.endsWith(")")) {
      segments.push({
        alternatives: core
          .slice(1, -1)
          .split("|")
          .map((t) => t.trim())
          .filter(Boolean),
        quantifier,
      });
    } else {
      segments.push({ alternatives: [core], quantifier });
    }
  }
  return segments;
}

function schemaTokensForEditorNode(
  nodeTypeName: string,
  schema: DescriptionSchema,
): string[] {
  const mapped = EDITOR_NODE_TO_TOKENS[nodeTypeName];
  if (mapped) return mapped;
  if (Object.prototype.hasOwnProperty.call(schema, nodeTypeName)) {
    return [nodeTypeName];
  }
  if (LOOSE_PARA_TYPES.has(nodeTypeName)) return ["para"];
  if (ATTENTION_TYPES.has(nodeTypeName)) return ["attentionElemGroup"];
  if (FMFT_TYPES.has(nodeTypeName)) {
    const tokens = [nodeTypeName];
    if (schema[nodeTypeName]?.group?.split(/\s+/).includes("fmftElemGroup")) {
      tokens.push("fmftElemGroup");
    }
    return tokens;
  }
  return [nodeTypeName];
}

function tokenMatchesNodeType(
  token: string,
  nodeTypeName: string,
  schema: DescriptionSchema,
): boolean {
  if (token === nodeTypeName) return true;
  if (schemaTokensForEditorNode(nodeTypeName, schema).includes(token)) {
    return true;
  }
  if (token === "fmftElemGroup" && FMFT_TYPES.has(nodeTypeName)) return true;
  if (token === "attentionElemGroup" && ATTENTION_TYPES.has(nodeTypeName)) {
    return true;
  }
  if (token === "para" && LOOSE_PARA_TYPES.has(nodeTypeName)) return true;
  if (token === "catalogSeqNumber" && nodeTypeName === "catalogSeqNumberGroup") {
    return true;
  }
  const group = schema[nodeTypeName]?.group;
  if (group && group.split(/\s+/).includes(token)) return true;
  return false;
}

/** 节点类型是否出现在 content 规则的任一 segment 中。 */
export function nodeTypeAllowedInContentRule(
  nodeTypeName: string,
  rule: string,
  schema: DescriptionSchema,
): boolean {
  const segments = parseContentSegments(rule);
  if (segments.length === 0) return false;
  for (const segment of segments) {
    for (const token of segment.alternatives) {
      if (tokenMatchesNodeType(token, nodeTypeName, schema)) return true;
    }
  }
  return false;
}

/** 编辑器内父容器 → schema `content` 规则字符串。 */
export function resolveSchemaContentRuleForEditorParent(
  parentTypeName: string,
  schema: DescriptionSchema,
): string {
  const kind = getDmContentKind(schema);
  switch (parentTypeName) {
    case "doc":
      switch (kind) {
        case "ipd":
          return schema.illustratedPartsCatalog?.content ?? "";
        case "procedure":
          return schema.procedure?.content ?? "";
        case "crew":
          return schema.crew?.content ?? "";
        case "faultIsolation":
          return schema.faultIsolation?.content ?? "";
        default:
          return schema.description?.content ?? "";
      }
    case "levelledPara":
      return schema.levelledPara?.content ?? "";
    case "proceduralStep":
      return schema.proceduralStep?.content ?? "";
    case "mainProcedure":
      return schema.mainProcedure?.content ?? "";
    case "preliminaryRqmts":
      return schema.preliminaryRqmts?.content ?? "";
    case "closeRqmts":
      return schema.closeRqmts?.content ?? "";
    case "catalogSeqNumberGroup":
      return schema.catalogSeqNumber?.content ?? "catalogSeqNumber+";
    case "faultIsolationProcedure":
      return schema.faultIsolationProcedure?.content ?? "";
    case "isolationMainProcedure":
      return schema.isolationMainProcedure?.content ?? "";
    case "isolationProcedure":
      return schema.isolationProcedure?.content ?? "";
    case "isolationStep":
      return schema.isolationStep?.content ?? "";
    default:
      return schema[parentTypeName]?.content ?? "";
  }
}

/** 该容器是否允许直接子节点为 `para` / `paragraph`。 */
export function containerAllowsLooseParaChild(
  parentTypeName: string,
  schema: DescriptionSchema,
): boolean {
  const rule = resolveSchemaContentRuleForEditorParent(parentTypeName, schema);
  return nodeTypeAllowedInContentRule("para", rule, schema);
}

/** 宿主块（figure 等）后是否允许插入 trailing `para`。 */
export function containerAllowsTrailingPara(
  parentTypeName: string,
  schema: DescriptionSchema,
): boolean {
  return containerAllowsLooseParaChild(parentTypeName, schema);
}

/** 子节点是否为该容器下非法的 loose `para` / `paragraph`。 */
export function isIllegalLooseParaInContainer(
  parentTypeName: string,
  childTypeName: string,
  schema: DescriptionSchema,
): boolean {
  if (!LOOSE_PARA_TYPES.has(childTypeName)) return false;
  return !containerAllowsLooseParaChild(parentTypeName, schema);
}

function shouldScanContainer(typeName: string, schema: DescriptionSchema): boolean {
  return Boolean(resolveSchemaContentRuleForEditorParent(typeName, schema).trim());
}

/** 统计文档中非法 loose `para` / `paragraph` 数量。 */
export function countIllegalLooseParas(
  doc: PMNode,
  schema: DescriptionSchema,
): number {
  let count = 0;
  doc.descendants((node, _pos, parent) => {
    if (!parent) return;
    if (
      isIllegalLooseParaInContainer(
        parent.type.name,
        node.type.name,
        schema,
      )
    ) {
      count++;
    }
  });
  return count;
}

/** 收集文档树中不符合 schema 的 loose `para` / `paragraph` 区间。 */
export function collectIllegalLooseParaRanges(
  doc: PMNode,
  schema: DescriptionSchema,
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];

  doc.descendants((node, pos, parent) => {
    if (!parent) return;
    if (!shouldScanContainer(parent.type.name, schema)) return;
    if (
      !isIllegalLooseParaInContainer(
        parent.type.name,
        node.type.name,
        schema,
      )
    ) {
      return;
    }
    const to = pos + node.nodeSize;
    if (to > doc.content.size) return;
    ranges.push({ from: pos, to });
  });

  return ranges;
}

/** 按 `from` 降序安全删除非法 loose `para` / `paragraph`。 */
export function deleteIllegalLooseParaRanges(
  tr: Transaction,
  ranges: { from: number; to: number }[],
): boolean {
  if (ranges.length === 0) return false;

  const sorted = [...ranges].sort((a, b) => b.from - a.from);
  let changed = false;

  for (const { from, to } of sorted) {
    const size = tr.doc.content.size;
    if (from < 0 || to > size || from >= to) continue;
    const node = tr.doc.nodeAt(from);
    if (!node || !LOOSE_PARA_TYPES.has(node.type.name)) continue;
    if (to !== from + node.nodeSize) continue;
    tr.delete(from, to);
    changed = true;
  }

  return changed;
}

/** 导出 JSON 时过滤 `doc` 下非法 loose `para` / `paragraph`。 */
export function filterDocChildrenForSchemaExport(
  children: { type?: string }[],
  schema: DescriptionSchema,
): { type?: string }[] {
  return children.filter(
    (child) =>
      !isIllegalLooseParaInContainer("doc", child.type ?? "", schema),
  );
}

/**
 * 当前 `TextSelection` 是否落在 schema 不允许 loose `para` 的位置
 *（如图解类 `doc` 末尾间隙、非法 `doc` 直系 `para` 内）。
 */
export function isIllegalTextCursorPos(
  $pos: ResolvedPos,
  schema: DescriptionSchema,
): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (!LOOSE_PARA_TYPES.has(node.type.name)) continue;
    const parent = $pos.node(d - 1);
    return isIllegalLooseParaInContainer(
      parent.type.name,
      node.type.name,
      schema,
    );
  }

  if (
    $pos.parent.type.name === "doc" &&
    !containerAllowsLooseParaChild("doc", schema)
  ) {
    return true;
  }

  return false;
}

/** 点击非法文本区时，回退为选中点击位置之前最近的顶层块。 */
export function resolveBlockNodeSelectionBeforePos(
  doc: PMNode,
  clickPos: number,
): number | null {
  let pos = 1;
  let lastBlockPos: number | null = null;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (pos <= clickPos && child.isBlock) {
      lastBlockPos = pos;
    }
    pos += child.nodeSize;
  }
  return lastBlockPos;
}
