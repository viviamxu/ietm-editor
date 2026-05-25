import type { DescriptionSchema } from "../../types/descriptionSchema";

/** DM 正文根类型：由 schema 的 `content.content`（及 XML `<content>` 子元素）决定。 */
export type DmContentKind = "description" | "faultIsolation";

/**
 * 根据描述类 / 故障隔离 schema 判定编辑器模式。
 * 宿主应保证 `setDescriptionSchema` 与导入的 DM XML 类型一致。
 */
export function getDmContentKind(schema: DescriptionSchema): DmContentKind {
  const contentRule = schema.content?.content ?? "";
  if (/\bfaultIsolation\b/.test(contentRule)) {
    return "faultIsolation";
  }
  if (/\bdescription\b/.test(contentRule)) {
    return "description";
  }
  if (
    Object.prototype.hasOwnProperty.call(schema, "faultIsolation") &&
    !Object.prototype.hasOwnProperty.call(schema, "description")
  ) {
    return "faultIsolation";
  }
  return "description";
}

export function isDescriptionDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "description";
}

export function isFaultIsolationDm(schema: DescriptionSchema): boolean {
  return getDmContentKind(schema) === "faultIsolation";
}
