import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import {
  resolveHostBlockPosFromSelection,
  resolveHostBlockPosNear,
} from "./insertParaAfterFmftBlock";
import { getDmContentKind } from "../s1000d/dmContentKind";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

export type FmftInsertResult =
  | { ok: true; fmftBlockPos?: number }
  | { ok: false };

export type ProcedureFmftInsertResolution =
  | { kind: "cursor" }
  | { kind: "at"; pos: number }
  | { kind: "blocked" };

const PROCEDURE_SECTION_BLOCK_TYPES = new Set([
  "preliminaryRqmts",
  "closeRqmts",
]);

function isInsideProcedureSectionBlock(editor: Editor, pos: number): boolean {
  const $pos = editor.state.doc.resolve(pos);
  for (let d = $pos.depth; d >= 0; d--) {
    if (PROCEDURE_SECTION_BLOCK_TYPES.has($pos.node(d).type.name)) {
      return true;
    }
  }
  return false;
}

/**
 * 程序类：`table` / `multimedia` 等 `fmftElemGroup` 只能落在 `proceduralStep` 内。
 * - 已在步骤内 → 沿用当前光标；
 * - 在 `mainProcedure` 但不在步骤内 → 落到最近 `proceduralStep` 末尾；
 * - 在 `preliminaryRqmts` / `closeRqmts` 或无法定位步骤 → 拒绝插入。
 */
export function resolveProcedureFmftInsert(
  editor: Editor,
): ProcedureFmftInsertResolution | null {
  if (getDmContentKind(getDescriptionSchema()) !== "procedure") {
    return null;
  }

  const { selection } = editor.state;
  const $from = selection.$from;

  if (isInsideProcedureSectionBlock(editor, selection.from)) {
    return { kind: "blocked" };
  }

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "proceduralStep") {
      return { kind: "cursor" };
    }
  }

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name !== "mainProcedure") continue;

    const main = $from.node(d);
    const mainPos = $from.before(d);
    if (main.childCount === 0) {
      return { kind: "blocked" };
    }

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

    return { kind: "at", pos: stepPos + step.nodeSize - 1 };
  }

  return { kind: "blocked" };
}

function resolveInsertedHostBlockPos(
  editor: Editor,
  fallbackNearPos: number,
): number | undefined {
  return (
    resolveHostBlockPosFromSelection(editor) ??
    resolveHostBlockPosNear(editor, fallbackNearPos)
  );
}

/** 在解析后的位置插入 `fmftElemGroup` 块（`table` / `multimedia` / `figure` 等）。 */
export function insertFmftNodesIntoEditor(
  editor: Editor,
  nodes: JSONContent | JSONContent[],
): FmftInsertResult {
  const payload = Array.isArray(nodes)
    ? nodes.length === 1
      ? nodes[0]
      : nodes
    : nodes;
  if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
    return { ok: false };
  }

  const { selection } = editor.state;
  let plannedInsertPos: number | null = null;

  if (selection instanceof NodeSelection) {
    if (isInsideProcedureSectionBlock(editor, selection.from)) {
      return { ok: false };
    }
    plannedInsertPos = selection.from + selection.node.nodeSize;
    if (!editor.can().insertContentAt(plannedInsertPos, payload)) {
      return { ok: false };
    }
    const ok = editor
      .chain()
      .focus()
      .insertContentAt(plannedInsertPos, payload)
      .run();
    if (!ok) return { ok: false };
    return {
      ok: true,
      fmftBlockPos: resolveInsertedHostBlockPos(editor, plannedInsertPos),
    };
  }

  const resolution = resolveProcedureFmftInsert(editor);
  if (resolution?.kind === "blocked") {
    return { ok: false };
  }

  if (resolution?.kind === "at") {
    plannedInsertPos = resolution.pos;
    if (!editor.can().insertContentAt(plannedInsertPos, payload)) {
      return { ok: false };
    }
    const ok = editor
      .chain()
      .focus()
      .insertContentAt(plannedInsertPos, payload)
      .run();
    if (!ok) return { ok: false };
    return {
      ok: true,
      fmftBlockPos: resolveInsertedHostBlockPos(editor, plannedInsertPos),
    };
  }

  plannedInsertPos = selection.from;
  if (!editor.can().insertContent(payload)) {
    return { ok: false };
  }
  const ok = editor.chain().focus().insertContent(payload).run();
  if (!ok) return { ok: false };
  return {
    ok: true,
    fmftBlockPos: resolveInsertedHostBlockPos(editor, plannedInsertPos),
  };
}
