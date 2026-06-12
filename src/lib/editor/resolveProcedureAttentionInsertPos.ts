import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import { getDmContentKind } from "../s1000d/dmContentKind";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

export type ProcedureAttentionInsertResolution =
  | { kind: "cursor" }
  | { kind: "at"; pos: number }
  | { kind: "blocked" };

const ATTENTION_SHELL_TYPES = new Set(["warning", "caution", "note"]);

/** 光标是否在 `warning` / `caution` / `note` 内部（含 attention 列表等）。 */
function isInsideAttentionShell($from: ResolvedPos): boolean {
  for (let d = $from.depth; d >= 0; d--) {
    if (ATTENTION_SHELL_TYPES.has($from.node(d).type.name)) return true;
  }
  return false;
}

function findNearestProceduralStepEndInMain(
  editor: Editor,
): { pos: number } | null {
  const { selection } = editor.state;
  const $from = selection.$from;

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name !== "mainProcedure") continue;

    const main = $from.node(d);
    const mainPos = $from.before(d);
    if (main.childCount === 0) return null;

    let stepPos = mainPos + 1;
    let step: PMNode = main.child(0);
    for (let i = 1; i < main.childCount; i++) {
      const next = main.child(i);
      const nextPos = stepPos + step.nodeSize;
      if (selection.from >= nextPos) {
        stepPos = nextPos;
        step = next;
      } else {
        break;
      }
    }

    return { pos: stepPos + step.nodeSize - 1 };
  }
  return null;
}

function isBlockedPreliminaryOrCloseRqmtsAtPos(doc: PMNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d >= 0; d--) {
    if ($pos.node(d).type.name === "safetyRqmts") return false;
  }
  for (let d = $pos.depth; d >= 0; d--) {
    const name = $pos.node(d).type.name;
    if (name === "closeRqmts" || name === "preliminaryRqmts") return true;
  }
  return false;
}

/**
 * 程序类：`warning` / `caution` / `note` 只能落在 `proceduralStep` 或 `safetyRqmts` 内。
 * - `safetyRqmts` → 追加到容器末尾；
 * - 已在步骤内 → 沿用当前光标；
 * - 在 `mainProcedure` 但不在步骤内 → 落到最近 `proceduralStep` 末尾；
 * - 在 `preliminaryRqmts`（非 `safetyRqmts`）/ `closeRqmts` → 拒绝插入。
 */
export function resolveProcedureAttentionInsert(
  editor: Editor,
): ProcedureAttentionInsertResolution | null {
  if (getDmContentKind(getDescriptionSchema()) !== "procedure") {
    return null;
  }

  const { selection } = editor.state;
  const $from = selection.$from;

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "safetyRqmts") {
      const safety = $from.node(d);
      const safetyPos = $from.before(d);
      return { kind: "at", pos: safetyPos + safety.nodeSize - 1 };
    }
  }

  if (isBlockedPreliminaryOrCloseRqmtsAtPos(editor.state.doc, selection.from)) {
    return { kind: "blocked" };
  }

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "proceduralStep") {
      return { kind: "cursor" };
    }
  }

  const stepEnd = findNearestProceduralStepEndInMain(editor);
  if (stepEnd) {
    return { kind: "at", pos: stepEnd.pos };
  }

  return { kind: "blocked" };
}

export function resolveAttentionInsertPosForEditor(
  editor: Editor,
): number | "cursor" | null {
  const { selection, doc } = editor.state;

  if (isInsideAttentionShell(selection.$from)) return null;

  if (selection instanceof NodeSelection) {
    const procedureResolution = resolveProcedureAttentionInsert(editor);
    if (procedureResolution?.kind === "blocked") return null;
    if (
      procedureResolution != null &&
      isBlockedPreliminaryOrCloseRqmtsAtPos(doc, selection.from)
    ) {
      return null;
    }
    return selection.from + selection.node.nodeSize;
  }

  const procedureResolution = resolveProcedureAttentionInsert(editor);
  if (procedureResolution?.kind === "blocked") return null;
  if (procedureResolution?.kind === "at") return procedureResolution.pos;
  if (procedureResolution?.kind === "cursor") return "cursor";
  return "cursor";
}

/** 当前选区是否允许插入 `warning` / `caution` / `note` 块。 */
export function canInsertAttentionNodeIntoEditor(
  editor: Editor,
  node: JSONContent,
): boolean {
  const insertPos = resolveAttentionInsertPosForEditor(editor);
  if (insertPos == null) return false;
  if (insertPos === "cursor") {
    return editor.can().insertContent(node);
  }
  return editor.can().insertContentAt(insertPos, node);
}

/** 在 schema 合法位置插入 `warning` / `caution` / `note` 块。 */
export function insertAttentionNodeIntoEditor(
  editor: Editor,
  node: JSONContent,
): boolean {
  if (!canInsertAttentionNodeIntoEditor(editor, node)) return false;

  const insertPos = resolveAttentionInsertPosForEditor(editor);
  if (insertPos == null) return false;

  if (insertPos === "cursor") {
    return editor.chain().focus().insertContent(node).run();
  }
  return editor.chain().focus().insertContentAt(insertPos, node).run();
}
