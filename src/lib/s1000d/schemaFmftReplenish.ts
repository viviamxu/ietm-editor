import type { Node as PMNode } from "@tiptap/pm/model";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { getDmContentKind } from "./dmContentKind";

const ATTENTION_BLOCK_TYPES = new Set(["warning", "caution", "note"]);

export function countFmftBlocksInSiblings(siblings: PMNode[]): number {
  return siblings.filter(
    (n) => n.type.name === "figure" || n.type.name === "multimedia",
  ).length;
}

/** 编辑器内父容器 → 对应 DescriptionSchema `content` 规则字符串。 */
export function resolveSchemaContentRuleForEditorParent(
  parentTypeName: string,
  schema: DescriptionSchema,
): string {
  const kind = getDmContentKind(schema);
  switch (parentTypeName) {
    case "levelledPara":
      return schema.levelledPara?.content ?? "";
    case "proceduralStep":
      return (
        schema.proceduralStep?.content ??
        schema.mainProcedure?.content ??
        ""
      );
    case "doc":
      switch (kind) {
        case "ipd":
          return schema.illustratedPartsCatalog?.content ?? "";
        case "procedure":
          return schema.procedure?.content ?? "";
        case "faultIsolation":
          return schema.faultIsolation?.content ?? "";
        default:
          return schema.description?.content ?? "";
      }
    default:
      return "";
  }
}

function siblingsSatisfyMixedAlternationPlus(
  alternates: string[],
  siblings: PMNode[],
): boolean {
  for (const alt of alternates) {
    if (alt === "para" && siblings.some((n) => n.type.name === "para")) {
      return true;
    }
    if (
      alt === "attentionElemGroup" &&
      siblings.some((n) => ATTENTION_BLOCK_TYPES.has(n.type.name))
    ) {
      return true;
    }
    if (alt === "fmftElemGroup") {
      if (countFmftBlocksInSiblings(siblings) > 0) return true;
      if (siblings.some((n) => n.type.name === "table")) return true;
    }
    if (alt === "figure" && siblings.some((n) => n.type.name === "figure")) {
      return true;
    }
    if (
      alt === "multimedia" &&
      siblings.some((n) => n.type.name === "multimedia")
    ) {
      return true;
    }
    if (alt === "levelledPara") {
      if (siblings.some((n) => n.type.name === "levelledPara")) return true;
    }
    if (alt === "catalogSeqNumber" || alt === "catalogSeqNumberGroup") {
      if (
        siblings.some(
          (n) =>
            n.type.name === "catalogSeqNumber" ||
            n.type.name === "catalogSeqNumberGroup",
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 删除 figure/multimedia 后 sibling 中已无 fmft 块时，是否须补空 figure/multimedia
 * 以满足 schema `content`（如图解类 `(figure|multimedia)+`）。
 */
export function shouldReplenishEmptyFmftAfterDelete(
  parentTypeName: string,
  siblingsAfterDelete: PMNode[],
  schema: DescriptionSchema,
): boolean {
  if (countFmftBlocksInSiblings(siblingsAfterDelete) > 0) return false;

  const rule = resolveSchemaContentRuleForEditorParent(
    parentTypeName,
    schema,
  ).trim();
  if (!rule) return false;

  if (/\bfigure\+/.test(rule) || /\bmultimedia\+/.test(rule)) {
    return true;
  }

  const altPlus = rule.match(/\(([^)]+)\)\+/g) ?? [];
  for (const segment of altPlus) {
    const inner = segment.slice(1, -2);
    const alternates = inner.split("|").map((t) => t.trim());
    const fmftAlternates = alternates.filter(
      (t) =>
        t === "figure" ||
        t === "multimedia" ||
        t === "fmftElemGroup",
    );
    if (fmftAlternates.length === 0) continue;

    if (fmftAlternates.length === alternates.length) {
      return true;
    }

    if (!siblingsSatisfyMixedAlternationPlus(alternates, siblingsAfterDelete)) {
      return fmftAlternates.length > 0;
    }
  }

  if (/\bfmftElemGroup\+/.test(rule)) {
    const hasPara = siblingsAfterDelete.some((n) => n.type.name === "para");
    const hasAttention = siblingsAfterDelete.some((n) =>
      ATTENTION_BLOCK_TYPES.has(n.type.name),
    );
    return !hasPara && !hasAttention;
  }

  return false;
}
