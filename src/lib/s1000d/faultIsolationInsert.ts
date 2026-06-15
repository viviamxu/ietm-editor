import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { isFaultIsolationDm } from "./dmContentKind";

const ISOLATION_REF_ID_PATTERN = /^stp-(\d+)$/i;

/** 扫描文档中已有 `stp-NNNN` 的最大序号。 */
export function maxIsolationRefIdInDoc(doc: PMNode): number {
  let max = 0;
  doc.descendants((node) => {
    if (
      node.type.name !== "isolationStep" &&
      node.type.name !== "isolationProcedureEnd"
    ) {
      return;
    }
    const id = String(node.attrs.id ?? "").trim();
    const m = ISOLATION_REF_ID_PATTERN.exec(id);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  });
  return max;
}

export function formatIsolationRefId(sequence: number): string {
  return `stp-${String(sequence).padStart(4, "0")}`;
}

/** 在文档内分配下一个 `stp-NNNN` 引用 id（单次调用）。 */
export function allocateNextIsolationRefId(editor: Editor): string {
  return formatIsolationRefId(maxIsolationRefIdInDoc(editor.state.doc) + 1);
}

/**
 * 连续分配多个 id（同一轮循环内递增）。
 * `reservedIds` 可传入本轮已占用/即将占用的 `stp-xxxx`，避免与 flow 节点 id 冲突。
 */
export function createIsolationRefIdAllocator(
  doc: PMNode,
  reservedIds?: Iterable<string>,
): () => string {
  let max = maxIsolationRefIdInDoc(doc);
  if (reservedIds) {
    for (const id of reservedIds) {
      const m = ISOLATION_REF_ID_PATTERN.exec(String(id).trim());
      if (m) max = Math.max(max, Number.parseInt(m[1], 10));
    }
  }
  return () => {
    max += 1;
    return formatIsolationRefId(max);
  };
}

/** 在第一个 `isolationProcedureEnd` 之前插入；无结束块时插在末尾。 */
export function findInsertPosBeforeFirstEnd(
  main: PMNode,
  mainPos: number,
): number {
  let offset = 1;
  for (let i = 0; i < main.childCount; i++) {
    const child = main.child(i);
    if (child.type.name === "isolationProcedureEnd") {
      return mainPos + offset;
    }
    offset += child.nodeSize;
  }
  return mainPos + main.nodeSize - 1;
}

/** 从选区向上查找 `isolationMainProcedure`；若无则取文档中第一个。 */
export function findNearestIsolationMainProcedure(
  editor: Editor,
): { mainPos: number; main: PMNode } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "isolationMainProcedure") {
      return { mainPos: $from.before(d), main: node };
    }
  }

  let found: { mainPos: number; main: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "isolationMainProcedure") {
      found = { mainPos: pos, main: node };
      return false;
    }
  });
  return found;
}

/** 在 `isolationMainProcedure` 末尾插入步骤（位于结束块之前）。 */
export function insertIsolationStepInMainProcedure(
  editor: Editor,
  mainPos: number,
  main: PMNode,
): boolean {
  const id = allocateNextIsolationRefId(editor);
  const insertPos = findInsertPosBeforeFirstEnd(main, mainPos);
  return editor
    .chain()
    .insertContentAt(insertPos, buildMinimalIsolationStepJson(id))
    .run();
}

/** 在 `isolationMainProcedure` 末尾追加结束块。 */
export function insertIsolationProcedureEndInMainProcedure(
  editor: Editor,
  mainPos: number,
  main: PMNode,
): boolean {
  const id = allocateNextIsolationRefId(editor);
  const insertPos = mainPos + main.nodeSize - 1;
  return editor
    .chain()
    .insertContentAt(insertPos, buildMinimalIsolationProcedureEndJson(id))
    .run();
}

/** 在当前（或文档首个）`isolationMainProcedure` 中插入隔离步骤。 */
export function insertIsolationStepAtCursor(editor: Editor): boolean {
  const target = findNearestIsolationMainProcedure(editor);
  if (!target) return false;
  return insertIsolationStepInMainProcedure(
    editor,
    target.mainPos,
    target.main,
  );
}

/** 在当前（或文档首个）`isolationMainProcedure` 末尾插入隔离结束。 */
export function insertIsolationProcedureEndAtCursor(editor: Editor): boolean {
  const target = findNearestIsolationMainProcedure(editor);
  if (!target) return false;
  return insertIsolationProcedureEndInMainProcedure(
    editor,
    target.mainPos,
    target.main,
  );
}

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

/** `yesNoAnswer` JSON，可带入已有跳转 id。 */
export function buildYesNoAnswerJson(
  yesRef = "",
  noRef = "",
): JSONContent {
  return {
    type: "yesNoAnswer",
    content: [
      { type: "yesAnswer", attrs: { nextActionRefId: yesRef } },
      { type: "noAnswer", attrs: { nextActionRefId: noRef } },
    ],
  };
}

function serializeAnswerBranch(node: PMNode): string {
  return JSON.stringify(node.toJSON());
}

function parseCachedAnswerBranchJson(cached: string | null | undefined): JSONContent | null {
  if (cached == null || String(cached).trim() === "") return null;
  try {
    const parsed = JSON.parse(cached) as JSONContent;
    if (typeof parsed?.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function defaultAnswerBranchJson(kind: "yesNo" | "choices"): JSONContent {
  return kind === "yesNo"
    ? buildMinimalYesNoAnswerJson()
    : buildMinimalListOfChoicesJson();
}

/** 用单次 `replaceWith` 切换 `isolationStepAnswer` 子节点，避免 NodeView 残留。 */
export function replaceIsolationStepAnswerKind(
  editor: Editor,
  answerPos: number,
  kind: "yesNo" | "choices",
): boolean {
  const answer = editor.state.doc.nodeAt(answerPos);
  if (!answer || answer.type.name !== "isolationStepAnswer") return false;

  const current = answer.firstChild;
  const currentKind =
    current?.type.name === "listOfChoices" ? "choices" : "yesNo";
  if (currentKind === kind) return true;

  const nextAttrs = { ...answer.attrs } as Record<string, string | null>;
  if (current) {
    const serialized = serializeAnswerBranch(current);
    if (currentKind === "yesNo") {
      nextAttrs.cachedYesNoAnswerJson = serialized;
    } else {
      nextAttrs.cachedListOfChoicesJson = serialized;
    }
  }

  const cachedJson =
    kind === "yesNo"
      ? parseCachedAnswerBranchJson(
          nextAttrs.cachedYesNoAnswerJson as string | null | undefined,
        )
      : parseCachedAnswerBranchJson(
          nextAttrs.cachedListOfChoicesJson as string | null | undefined,
        );

  const branchJson = cachedJson ?? defaultAnswerBranchJson(kind);

  let newChild;
  try {
    newChild = editor.schema.nodeFromJSON(branchJson);
  } catch {
    return false;
  }

  const from = answerPos + 1;
  const to = answerPos + answer.nodeSize - 1;
  let tr = editor.state.tr.setNodeMarkup(answerPos, undefined, nextAttrs);
  tr = tr.replaceWith(from, to, newChild);
  editor.view.dispatch(tr);
  return true;
}

/** 最小 `yesNoAnswer`（空跳转 id，供编辑填写）。 */
export function buildMinimalYesNoAnswerJson(): JSONContent {
  return buildYesNoAnswerJson();
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

  // 不论光标在哪：都找「最近的 faultIsolationProcedure」并在其后插入同级兄弟。
  const { $from } = editor.state.selection;
  let procDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "faultIsolationProcedure") {
      procDepth = d;
      break;
    }
  }

  const procJson = buildMinimalFaultIsolationProcedureJson();
  const procNode = editor.schema.nodeFromJSON(procJson) as PMNode;

  const insertPos =
    procDepth >= 0 ? $from.after(procDepth) : editor.state.doc.content.size;

  editor.view.dispatch(editor.state.tr.insert(insertPos, procNode));
  editor.view.focus();
  return true;
}
