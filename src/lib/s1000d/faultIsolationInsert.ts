import type { Editor, JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { isFaultIsolationDm } from "./dmContentKind";

/** 最小 `yesNoAnswer`（空跳转 id，供编辑填写）。 */
function buildMinimalYesNoAnswerJson(): JSONContent {
  return {
    type: "yesNoAnswer",
    content: [
      { type: "yesAnswer", attrs: { nextActionRefId: "" } },
      { type: "noAnswer", attrs: { nextActionRefId: "" } },
    ],
  };
}

/** 最小 `isolationStep`（与 `故障类.XML` 样本结构对齐）。 */
export function buildMinimalIsolationStepJson(
  id = "",
): JSONContent {
  return {
    type: "isolationStep",
    attrs: { id },
    content: [
      { type: "action", content: [] },
      { type: "isolationStepQuestion", content: [] },
      {
        type: "isolationStepAnswer",
        content: [buildMinimalYesNoAnswerJson()],
      },
    ],
  };
}

/** 最小 `faultIsolationProcedure`。 */
export function buildMinimalFaultIsolationProcedureJson(): JSONContent {
  return {
    type: "faultIsolationProcedure",
    content: [
      { type: "fault", attrs: { faultCode: "" } },
      {
        type: "faultDescr",
        content: [{ type: "descr", content: [] }],
      },
      {
        type: "isolationProcedure",
        content: [
          {
            type: "isolationMainProcedure",
            content: [buildMinimalIsolationStepJson()],
          },
        ],
      },
    ],
  };
}

/** 故障隔离 DM 正文最小稿（`doc` 下直接为 `faultIsolationProcedure+`）。 */
export function buildEmptyFaultIsolationDocJson(): JSONContent {
  return {
    type: "doc",
    content: [buildMinimalFaultIsolationProcedureJson()],
  };
}

export function insertFaultIsolationFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!isFaultIsolationDm(schema)) return false;
  if (!editor.state.schema.nodes.faultIsolationProcedure) {
    return false;
  }
  return editor
    .chain()
    .focus()
    .insertContent(buildMinimalFaultIsolationProcedureJson())
    .run();
}
