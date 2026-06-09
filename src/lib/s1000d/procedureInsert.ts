import type { Editor, JSONContent } from "@tiptap/core";
import { Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { buildMinimalWarningAndCautionParaJson } from "./descriptionSchemaInsert";

export function buildMinimalPreliminaryRqmtsJson(): JSONContent {
  return {
    type: "preliminaryRqmts",
    content: [
      { type: "reqCondGroup", content: [{ type: "noConds", content: [] }] },
      { type: "reqPersons", content: [] },
      { type: "reqSupportEquips", content: [{ type: "noSupportEquips", content: [] }] },
      { type: "reqSupplies", content: [{ type: "noSupplies", content: [] }] },
      { type: "reqSpares", content: [{ type: "noSpares", content: [] }] },
      { type: "reqSafety", content: [{ type: "noSafety", content: [] }] },
    ],
  };
}

export function buildMinimalProceduralStepJson(): JSONContent {
  return {
    type: "proceduralStep",
    content: [
      { type: "title", content: [] },
      { type: "para", content: [] },
    ],
  };
}

export function buildMinimalMainProcedureJson(): JSONContent {
  return {
    type: "mainProcedure",
    content: [buildMinimalProceduralStepJson()],
  };
}

function getInnermostProceduralStepDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "proceduralStep") return d;
  }
  return -1;
}

function findNearestMainProcedure(
  editor: Editor,
): { mainPos: number; main: PMNode } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "mainProcedure") {
      return { mainPos: $from.before(d), main: node };
    }
  }

  let found: { mainPos: number; main: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "mainProcedure") {
      found = { mainPos: pos, main: node };
      return false;
    }
  });
  return found;
}

function selectionInProceduralStepTitle(
  doc: PMNode,
  stepPos: number,
): TextSelection | null {
  const node = doc.nodeAt(stepPos);
  if (!node || node.type.name !== "proceduralStep") return null;

  let offset = stepPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "title") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }

  const fallback = Math.min(stepPos + 2, doc.content.size);
  if (fallback < 0 || fallback > doc.content.size) return null;
  return TextSelection.create(doc, fallback);
}

/** 在父 `proceduralStep` 末尾插入子步骤，否则在 `mainProcedure` 末尾插入同级步骤。 */
export function insertProceduralStepAtCursor(editor: Editor): boolean {
  const stepType = editor.state.schema.nodes.proceduralStep;
  if (!stepType) return false;

  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      const stepDepth = getInnermostProceduralStepDepth($from);

      let child: PMNode;
      try {
        child = PMNode.fromJSON(state.schema, buildMinimalProceduralStepJson());
      } catch {
        return false;
      }
      if (child.type !== stepType) return false;

      let insertPos: number;

      if (stepDepth >= 0) {
        const host = $from.node(stepDepth);
        const hostPos = $from.before(stepDepth);
        const nextContent = host.content.addToEnd(child);
        if (!stepType.validContent(nextContent)) return false;
        insertPos = hostPos + host.nodeSize - 1;
      } else {
        const target = findNearestMainProcedure(editor);
        if (!target) return false;
        const { mainPos, main } = target;
        const mainType = main.type;
        if (!mainType.validContent(main.content.addToEnd(child))) return false;
        insertPos = mainPos + main.nodeSize - 1;
      }

      if (!dispatch) return true;

      tr.insert(insertPos, child);
      const sel = selectionInProceduralStepTitle(tr.doc, insertPos);
      if (sel) tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}

export function buildMinimalCloseRqmtsJson(): JSONContent {
  return {
    type: "closeRqmts",
    content: [
      {
        type: "reqCondGroup",
        content: [
          {
            type: "reqCondNoRef",
            content: [{ type: "reqCond", content: [] }],
          },
        ],
      },
    ],
  };
}

/** 程序类 DM 正文最小稿（`doc` 下为 `preliminaryRqmts mainProcedure closeRqmts`）。 */
export function buildEmptyProcedureDocJson(): JSONContent {
  return {
    type: "doc",
    content: [
      buildMinimalPreliminaryRqmtsJson(),
      buildMinimalMainProcedureJson(),
      buildMinimalCloseRqmtsJson(),
    ],
  };
}

/** 将 `noSafety` 替换为含一条空 `warning` 的 `safetyRqmts`。 */
export function insertSafetyRqmtsFromNoPlaceholder(
  editor: Editor,
  reqSafetyPos: number,
): void {
  const req = editor.state.doc.nodeAt(reqSafetyPos);
  if (!req || req.type.name !== "reqSafety") return;

  const safetyRqmtsType = editor.schema.nodes.safetyRqmts;
  if (!safetyRqmtsType) return;

  const schema = getDescriptionSchema();
  const safetyRqmts = PMNode.fromJSON(editor.schema, {
    type: "safetyRqmts",
    content: [
      {
        type: "warning",
        content: [buildMinimalWarningAndCautionParaJson(schema)],
      },
    ],
  });

  if (req.childCount === 1 && req.firstChild?.type.name === "noSafety") {
    const from = reqSafetyPos + 1;
    const to = from + req.firstChild.nodeSize;
    editor.view.dispatch(editor.state.tr.replaceWith(from, to, safetyRqmts));
  }
}
