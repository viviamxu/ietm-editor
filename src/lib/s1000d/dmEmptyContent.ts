import type { JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { buildEmptyDescriptionDocJson } from "./descriptionSchemaInsert";
import { buildEmptyFaultIsolationDocJson } from "./faultIsolationInsert";
import { buildEmptyProcedureDocJsonFromSchema } from "./procedureInsert";
import { buildEmptyIpdDocJson } from "./ipdInsert";
import { getDmContentKind } from "./dmContentKind";

/** 按当前 schema 的 DM 正文类型生成最小合法 `doc` JSON。 */
export function buildEmptyDocJsonFromSchema(
  schema: DescriptionSchema,
): JSONContent {
  const kind = getDmContentKind(schema);
  if (kind === "faultIsolation") {
    return buildEmptyFaultIsolationDocJson();
  }
  if (kind === "procedure") {
    return buildEmptyProcedureDocJsonFromSchema(schema);
  }
  if (kind === "ipd") {
    return buildEmptyIpdDocJson(schema);
  }
  return buildEmptyDescriptionDocJson(schema);
}
