import type { Node as PMNode } from "@tiptap/pm/model";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { resolveSchemaContentRuleForEditorParent } from "./schemaContentRuleValidate";

const ATTENTION_BLOCK_TYPES = new Set(["warning", "caution", "note"]);

/** `reqSafety` 下 `safetyRqmts`：删光 attention 后回退 `noSafety`，不补空 warning/note。 */
export function isReqSafetyAttentionParent(parentTypeName: string): boolean {
  return parentTypeName === "safetyRqmts";
}

/**
 * 删除 attention 块后是否须在原位补空 warning/caution/note。
 * `safetyRqmts`（`reqSafety` 子树）始终 false：由 {@link deleteAttentionBlockAtPos} 回退 `noSafety`。
 */
export function shouldReplenishEmptyAttentionAfterDelete(
  parentTypeName: string,
  siblingsAfterDelete: PMNode[],
  schema: DescriptionSchema,
): boolean {
  if (isReqSafetyAttentionParent(parentTypeName)) {
    return false;
  }

  const rule = resolveSchemaContentRuleForEditorParent(
    parentTypeName,
    schema,
  ).trim();
  if (!rule) return false;

  if (/\battentionElemGroup\+/.test(rule)) {
    const hasAttention = siblingsAfterDelete.some((n) =>
      ATTENTION_BLOCK_TYPES.has(n.type.name),
    );
    return !hasAttention;
  }

  const altPlus = rule.match(/\(([^)]+)\)\+/g) ?? [];
  for (const segment of altPlus) {
    const inner = segment.slice(1, -2);
    const alternates = inner.split("|").map((t) => t.trim());
    if (!alternates.includes("attentionElemGroup")) continue;

    const hasAttention = siblingsAfterDelete.some((n) =>
      ATTENTION_BLOCK_TYPES.has(n.type.name),
    );
    const hasPara = siblingsAfterDelete.some((n) => n.type.name === "para");
    const hasFmft = siblingsAfterDelete.some(
      (n) =>
        n.type.name === "figure" ||
        n.type.name === "multimedia" ||
        n.type.name === "table",
    );

    if (alternates.length === 1 && alternates[0] === "attentionElemGroup") {
      return !hasAttention;
    }

    if (!hasAttention && !hasPara && !hasFmft) {
      return true;
    }
  }

  return false;
}
