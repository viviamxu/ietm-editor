import type { JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { resolvePreferredFmftBlockType } from "./resolveFmftPublicationMode";

/** 与「清空内容」/ 图解空稿一致的空 `figure`（占位「点击选择图片」）。 */
export function buildEmptyFigureBlockJson(): JSONContent {
  return {
    type: "figure",
    content: [{ type: "title", content: [] }],
  };
}

/** 与「清空内容」/ 图解空稿一致的空 `multimedia`。 */
export function buildEmptyMultimediaBlockJson(): JSONContent {
  return {
    type: "multimedia",
    content: [
      { type: "multimediaObject", attrs: { infoEntityIdent: "" } },
    ],
  };
}

/** 按当前 schema 偏好生成空 `figure` 或 `multimedia` JSON。 */
export function buildEmptyFmftBlockJson(
  schema: DescriptionSchema,
): JSONContent {
  const preferred = resolvePreferredFmftBlockType(schema);
  return preferred === "multimedia"
    ? buildEmptyMultimediaBlockJson()
    : buildEmptyFigureBlockJson();
}
