import type { DescriptionSchema } from "../../types/descriptionSchema";

/** DM 正文根类型：由 schema 的 `content.content`（及 XML `<content>` 子元素）决定。 */
export type DmContentKind =
  | "description"
  | "faultIsolation"
  | "procedure"
  | "ipd";

/**
 * 根据描述类 / 故障隔离 / 程序类 schema 判定编辑器模式。
 * 宿主应保证 `setDescriptionSchema` 与导入的 DM XML 类型一致。
 */
export function getDmContentKind(schema: DescriptionSchema): DmContentKind {
  const contentRule = schema.content?.content ?? "";
  if (/\billustratedPartsCatalog\b/.test(contentRule)) {
    return "ipd";
  }
  if (/\bfaultIsolation\b/.test(contentRule)) {
    return "faultIsolation";
  }
  if (/\bprocedure\b/.test(contentRule)) {
    return "procedure";
  }
  if (/\bdescription\b/.test(contentRule)) {
    return "description";
  }
  if (
    Object.prototype.hasOwnProperty.call(schema, "faultIsolation") &&
    !Object.prototype.hasOwnProperty.call(schema, "description") &&
    !Object.prototype.hasOwnProperty.call(schema, "procedure")
  ) {
    return "faultIsolation";
  }
  if (
    Object.prototype.hasOwnProperty.call(schema, "procedure") &&
    !Object.prototype.hasOwnProperty.call(schema, "description")
  ) {
    return "procedure";
  }
  return "description";
}

export function isDescriptionDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "description";
}

export function isFaultIsolationDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "faultIsolation";
}

export function isProcedureDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "procedure";
}

export function isIpdDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "ipd";
}
