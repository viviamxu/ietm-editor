import type { JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";

export function buildMinimalCrewDrillStepJson(): JSONContent {
  return {
    type: "crewDrillStep",
    content: [{ type: "title", content: [] }],
  };
}

export function buildMinimalCrewDrillJson(): JSONContent {
  return {
    type: "crewDrill",
    content: [
      { type: "title", content: [] },
      buildMinimalCrewDrillStepJson(),
    ],
  };
}

export function buildMinimalCrewRefCardJson(): JSONContent {
  return {
    type: "crewRefCard",
    content: [
      { type: "title", content: [] },
      buildMinimalCrewDrillJson(),
    ],
  };
}

/** 操作类 DM 正文最小稿（`doc` 下为 `crewRefCard`）。 */
export function buildEmptyCrewDocJsonFromSchema(
  _schema: DescriptionSchema,
): JSONContent {
  return {
    type: "doc",
    content: [buildMinimalCrewRefCardJson()],
  };
}

export function buildEmptyCrewDocJson(
  schema: DescriptionSchema,
): JSONContent {
  return buildEmptyCrewDocJsonFromSchema(schema);
}
