import type { JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";

/** 解析 schema `content` 规则中的独立元素 token（去掉 `?` `+` `|` 等后缀）。 */
export function parseSchemaContentRuleTokens(rule: string | undefined): string[] {
  if (!rule?.trim()) return [];
  return rule
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[?+*]|(\|.*)$/g, "").trim())
    .filter(Boolean);
}

function hasSchemaNode(schema: DescriptionSchema, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

function buildMinimalPreliminaryReqChild(nodeName: string): JSONContent | null {
  switch (nodeName) {
    case "reqCondGroup":
      return {
        type: "reqCondGroup",
        content: [{ type: "noConds", content: [] }],
      };
    case "reqPersons":
      return { type: "reqPersons", content: [] };
    case "reqSupportEquips":
      return {
        type: "reqSupportEquips",
        content: [{ type: "noSupportEquips", content: [] }],
      };
    case "reqSupplies":
      return {
        type: "reqSupplies",
        content: [{ type: "noSupplies", content: [] }],
      };
    case "reqSpares":
      return {
        type: "reqSpares",
        content: [{ type: "noSpares", content: [] }],
      };
    case "reqSafety":
      return {
        type: "reqSafety",
        content: [{ type: "noSafety", content: [] }],
      };
    default:
      return null;
  }
}

const DEFAULT_PRELIMINARY_RQMTS_TOKENS = [
  "reqCondGroup",
  "reqPersons",
  "reqSupportEquips",
  "reqSupplies",
  "reqSpares",
  "reqSafety",
] as const;

/** 按 `schema.preliminaryRqmts.content` 组装最小 `preliminaryRqmts`（仅含 schema 声明的子块）。 */
export function buildMinimalPreliminaryRqmtsJsonFromSchema(
  schema: DescriptionSchema,
): JSONContent {
  const declared = parseSchemaContentRuleTokens(schema.preliminaryRqmts?.content);
  const tokens =
    declared.length > 0 ? declared : [...DEFAULT_PRELIMINARY_RQMTS_TOKENS];

  const content = tokens
    .filter((name) => hasSchemaNode(schema, name))
    .map(buildMinimalPreliminaryReqChild)
    .filter((node): node is JSONContent => node != null);

  if (content.length === 0) {
    content.push({
      type: "reqCondGroup",
      content: [{ type: "noConds", content: [] }],
    });
  }

  return { type: "preliminaryRqmts", content };
}

/** 按 `schema.closeRqmts.content` 组装最小 `closeRqmts`。 */
export function buildMinimalCloseRqmtsJsonFromSchema(
  schema: DescriptionSchema,
): JSONContent {
  const declared = parseSchemaContentRuleTokens(schema.closeRqmts?.content);
  const tokens = declared.length > 0 ? declared : ["reqCondGroup"];

  const content = tokens
    .filter((name) => hasSchemaNode(schema, name))
    .map(buildMinimalPreliminaryReqChild)
    .filter((node): node is JSONContent => node != null);

  if (content.length === 0) {
    return {
      type: "closeRqmts",
      content: [
        {
          type: "reqCondGroup",
          content: [
            {
              type: "reqCondNoRef",
              content: [{ type: "reqCond", content: [] }],
            },
          ],
        },
      ],
    };
  }

  if (content[0]?.type === "reqCondGroup") {
    const group = content[0];
    const hasCond =
      group.content?.some((c) => c.type === "reqCondNoRef") ?? false;
    if (!hasCond) {
      content[0] = {
        ...group,
        content: [
          {
            type: "reqCondNoRef",
            content: [{ type: "reqCond", content: [] }],
          },
        ],
      };
    }
  }

  return { type: "closeRqmts", content };
}
