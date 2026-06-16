import type { Node as PMNode } from "@tiptap/pm/model";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { getDmContentKind, type DmContentKind } from "./dmContentKind";

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
    if (schema[nodeTypeName]?.group === "fmftElemGroup") {
      tokens.push("fmftElemGroup");
    }
    return tokens;
  }
  return [nodeTypeName];
}

function tokenMatchesNodeType(token: string, nodeTypeName: string, schema: DescriptionSchema): boolean {
  if (token === nodeTypeName) return true;
  const nodeTokens = schemaTokensForEditorNode(nodeTypeName, schema);
  if (nodeTokens.includes(token)) return true;
  if (token === "fmftElemGroup" && FMFT_TYPES.has(nodeTypeName)) return true;
  if (token === "attentionElemGroup" && ATTENTION_TYPES.has(nodeTypeName)) return true;
  if (token === "para" && LOOSE_PARA_TYPES.has(nodeTypeName)) return true;
  if (token === "catalogSeqNumber" && nodeTypeName === "catalogSeqNumberGroup") {
    return true;
  }
  const rule = schema[nodeTypeName]?.group;
  if (rule && rule.split(/\s+/).includes(token)) return true;
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

function resolveDocContentRule(schema: DescriptionSchema, kind: DmContentKind): string {
  const contentRule = schema.content?.content ?? "";
  if (/\billustratedPartsCatalog\b/.test(contentRule)) {
    return schema.illustratedPartsCatalog?.content ?? "";
  }
  switch (kind) {
    case "faultIsolation":
      return schema.faultIsolation?.content ?? "";
    case "procedure":
      return schema.procedure?.content ?? "";
    default:
      return schema.description?.content ?? "";
  }
}

/** 编辑器内父容器 → schema `content` 规则字符串。 */
export function resolveSchemaContentRuleForEditorParent(
  parentTypeName: string,
  schema: DescriptionSchema,
): string {
  const kind = getDmContentKind(schema);
  switch (parentTypeName) {
    case "doc":
      return resolveDocContentRule(schema, kind);
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

/** 该容器是否允许直接子节点为 `para` / `paragraph`（schema 驱动）。 */
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

/** 子节点是否为该容器 schema 规则下的非法块（用于清理 loose `para` 等）。 */
export function isIllegalChildForSchemaContentRule(
  parentTypeName: string,
  childTypeName: string,
  schema: DescriptionSchema,
): boolean {
  if (LOOSE_PARA_TYPES.has(childTypeName)) {
    return !containerAllowsLooseParaChild(parentTypeName, schema);
  }
  const rule = resolveSchemaContentRuleForEditorParent(parentTypeName, schema);
  if (!rule.trim()) return false;
  return !nodeTypeAllowedInContentRule(childTypeName, rule, schema);
}

const CONTAINERS_TO_SCAN_FOR_ILLEGAL_CHILDREN = new Set([
  "doc",
  "levelledPara",
  "proceduralStep",
  "mainProcedure",
  "preliminaryRqmts",
  "closeRqmts",
  "catalogSeqNumberGroup",
  "faultIsolationProcedure",
  "isolationMainProcedure",
  "isolationProcedure",
]);

function shouldScanContainer(typeName: string, schema: DescriptionSchema): boolean {
  if (CONTAINERS_TO_SCAN_FOR_ILLEGAL_CHILDREN.has(typeName)) return true;
  return Boolean(resolveSchemaContentRuleForEditorParent(typeName, schema).trim());
}

/** 收集文档树中不符合 schema content 的非法子节点区间（含 loose `para`）。 */
export function collectIllegalSchemaContentRanges(
  doc: PMNode,
  schema: DescriptionSchema,
  parentPos = 0,
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let pos = parentPos + 1;

  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    const childPos = pos;

    if (shouldScanContainer(doc.type.name, schema)) {
      if (
        isIllegalChildForSchemaContentRule(
          doc.type.name,
          child.type.name,
          schema,
        )
      ) {
        ranges.push({ from: childPos, to: childPos + child.nodeSize });
      }
    }

    if (child.childCount > 0 && shouldScanContainer(child.type.name, schema)) {
      ranges.push(
        ...collectIllegalSchemaContentRanges(child, schema, childPos),
      );
    }

    pos += child.nodeSize;
  }

  return ranges;
}

/** 导出 JSON 时过滤非法 `doc` 直系子节点。 */
export function filterDocChildrenForSchemaExport(
  children: { type?: string }[],
  schema: DescriptionSchema,
): { type?: string }[] {
  return children.filter(
    (child) =>
      !isIllegalChildForSchemaContentRule(
        "doc",
        child.type ?? "",
        schema,
      ),
  );
}
