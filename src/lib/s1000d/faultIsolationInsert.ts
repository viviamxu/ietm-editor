import type { Editor, JSONContent } from "@tiptap/core";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { isFaultIsolationDm } from "./dmContentKind";

/** 最小 `choice`（空文案与跳转 id）。 */
export function buildMinimalChoiceJson(): JSONContent {
  return {
    type: "choice",
    attrs: { nextActionRefId: "" },
    content: [],
  };
}

/** 构建 `listOfChoices` JSON。 */
export function buildMinimalListOfChoicesJson(): JSONContent {
  return {
    type: "listOfChoices",
    content: [buildMinimalChoiceJson()],
  };
}

/** 用单次 `replaceWith` 切换 `isolationStepAnswer` 子节点，避免 NodeView 残留。 */
export function replaceIsolationStepAnswerKind(
  editor: Editor,
  answerPos: number,
  kind: "yesNo" | "choices",
): boolean {
  const answer = editor.state.doc.nodeAt(answerPos);
  if (!answer || answer.type.name !== "isolationStepAnswer") return false;

  const json =
    kind === "yesNo"
      ? buildMinimalYesNoAnswerJson()
      : buildMinimalListOfChoicesJson();

  let newChild;
  try {
    newChild = editor.schema.nodeFromJSON(json);
  } catch {
    return false;
  }

  const from = answerPos + 1;
  const to = answerPos + answer.nodeSize - 1;
  editor.view.dispatch(editor.state.tr.replaceWith(from, to, newChild));
  return true;
}

/** 最小 `yesNoAnswer`（空跳转 id，供编辑填写）。 */
export function buildMinimalYesNoAnswerJson(): JSONContent {
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
      { type: "title", content: [] },
      { type: "action", content: [] },
      { type: "isolationStepQuestion", content: [] },
      {
        type: "isolationStepAnswer",
        content: [buildMinimalYesNoAnswerJson()],
      },
    ],
  };
}

/** 最小 `isolationProcedureEnd`（含可编辑结束标题）。 */
export function buildMinimalIsolationProcedureEndJson(
  id = "",
): JSONContent {
  return {
    type: "isolationProcedureEnd",
    attrs: { id },
    content: [
      { type: "title", content: [] },
      { type: "action", content: [] },
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
