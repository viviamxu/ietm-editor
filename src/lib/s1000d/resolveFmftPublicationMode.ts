import type { DescriptionSchema } from "../../types/descriptionSchema";
import type { InsertPublicationMode } from "../../store/insertPublicationModalStore";
import { getDmContentKind } from "./dmContentKind";

export type PreferredFmftBlockType = "figure" | "multimedia" | "table";

function contentRuleMentions(rule: string | undefined, token: string): boolean {
  if (!rule) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(rule);
}

function requireSchemaNode(schema: DescriptionSchema, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

/** 按 DM 类型取含 `figure` / `multimedia` / `fmftElemGroup` 的内容规则字符串。 */
export function resolveFmftContentRule(schema: DescriptionSchema): string {
  const kind = getDmContentKind(schema);
  switch (kind) {
    case "ipd":
      return schema.illustratedPartsCatalog?.content ?? "";
    case "procedure":
      return schema.proceduralStep?.content ?? schema.mainProcedure?.content ?? "";
    case "crew":
      return schema.crewDrillStep?.content ?? schema.crewDrill?.content ?? "";
    case "faultIsolation":
      return schema.faultIsolation?.content ?? "";
    default:
      return schema.description?.content ?? "";
  }
}

/**
 * 按 schema 内容规则决定默认 fmft 块类型。
 * 规则中同时出现 `figure` 与 `multimedia` 时，以 alternation 里先出现的为准；
 * 仅出现 `fmftElemGroup` 时，schema 同时含两者则默认 `figure`。
 */
export function resolvePreferredFmftBlockType(
  schema: DescriptionSchema,
): PreferredFmftBlockType | null {
  const rule = resolveFmftContentRule(schema);
  const hasFigure = contentRuleMentions(rule, "figure");
  const hasMultimedia = contentRuleMentions(rule, "multimedia");

  if (hasFigure && hasMultimedia) {
    const figureIndex = rule.search(/\bfigure\b/);
    const multimediaIndex = rule.search(/\bmultimedia\b/);
    return figureIndex <= multimediaIndex ? "figure" : "multimedia";
  }
  if (hasMultimedia && requireSchemaNode(schema, "multimedia")) {
    return "multimedia";
  }
  if (hasFigure && requireSchemaNode(schema, "figure")) {
    return "figure";
  }

  if (contentRuleMentions(rule, "fmftElemGroup")) {
    if (requireSchemaNode(schema, "figure")) return "figure";
    if (requireSchemaNode(schema, "multimedia")) return "multimedia";
    if (requireSchemaNode(schema, "table")) return "table";
  }

  if (requireSchemaNode(schema, "figure")) return "figure";
  if (requireSchemaNode(schema, "multimedia")) return "multimedia";
  if (requireSchemaNode(schema, "table")) return "table";
  return null;
}

/** 占位点击 / 空稿默认：映射为出版物弹框 mode。 */
export function resolveFmftPublicationMode(
  schema: DescriptionSchema,
): InsertPublicationMode {
  const preferred = resolvePreferredFmftBlockType(schema);
  return preferred === "multimedia" ? "multimedia" : "image";
}
