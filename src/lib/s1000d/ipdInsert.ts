import type { JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { buildEmptyFmftBlockJson } from "./buildEmptyFmftBlock";

/** 图解类 DM 正文最小稿：按 schema 默认 fmft 块 + 空 `catalogSeqNumberGroup`。 */
export function buildEmptyIpdDocJson(
  schema: DescriptionSchema = getDescriptionSchema(),
): JSONContent {
  return {
    type: "doc",
    content: [
      buildEmptyFmftBlockJson(schema),
      { type: "catalogSeqNumberGroup", content: [] },
    ],
  };
}
