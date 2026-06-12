import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { buildMinimalWarningAndCautionParaJson } from "./descriptionSchemaInsert";
import {
  buildMinimalCloseRqmtsJsonFromSchema,
  buildMinimalPreliminaryRqmtsJsonFromSchema,
  parseSchemaContentRuleTokens,
} from "./procedureSchemaBuild";
import type { DescriptionSchema } from "../../types/descriptionSchema";

export function buildMinimalPreliminaryRqmtsJson(
  schema: DescriptionSchema = getDescriptionSchema(),
): JSONContent {
  return buildMinimalPreliminaryRqmtsJsonFromSchema(schema);
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

function countChildNodesOfType(parent: PMNode, typeName: string): number {
  let count = 0;
  parent.forEach((child) => {
    if (child.type.name === typeName) count++;
  });
  return count;
}

function buildMinimalProceduralStepNode(schema: PMNode["type"]["schema"]): PMNode | null {
  try {
    return PMNode.fromJSON(schema, buildMinimalProceduralStepJson());
  } catch {
    return null;
  }
}

/** 解析 `proceduralStep` 节点及其文档起始位置（兼容 NodeView `getPos` 边界）。 */
export function resolveProceduralStepAtPos(
  doc: PMNode,
  pos: number,
): { step: PMNode; stepPos: number } | null {
  try {
    const atPos = doc.nodeAt(pos);
    if (atPos?.type.name === "proceduralStep") {
      return { step: atPos, stepPos: pos };
    }

    const $pos = doc.resolve(pos);
    const after = $pos.nodeAfter;
    if (after?.type.name === "proceduralStep") {
      return { step: after, stepPos: pos };
    }

    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name !== "proceduralStep") continue;
      const stepPos = $pos.before(d);
      const step = doc.nodeAt(stepPos);
      if (step?.type.name === "proceduralStep") {
        return { step, stepPos };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 按 `程序类.json`：`mainProcedure` 须保留 `proceduralStep+`；
 * 删最后一个一级步骤时会在删除后补默认步骤。嵌套 `proceduralStep*` 可删至 0。
 */
export function canDeleteProceduralStep(doc: PMNode, stepPos: number): boolean {
  const resolved = resolveProceduralStepAtPos(doc, stepPos);
  if (!resolved) return false;

  try {
    const { stepPos: actualPos } = resolved;
    const $pos = doc.resolve(actualPos);
    const parent = $pos.parent;
    const index = $pos.index();

    if (
      parent.type.name !== "mainProcedure" &&
      parent.type.name !== "proceduralStep"
    ) {
      return false;
    }

    const siblings: PMNode[] = [];
    for (let i = 0; i < parent.childCount; i++) {
      if (i !== index) siblings.push(parent.child(i));
    }

    if (
      parent.type.name === "mainProcedure" &&
      countChildNodesOfType(parent, "proceduralStep") <= 1
    ) {
      const defaultStep = buildMinimalProceduralStepNode(parent.type.schema);
      if (!defaultStep) return false;
      return parent.type.validContent(Fragment.from([...siblings, defaultStep]));
    }

    return parent.type.validContent(Fragment.from(siblings));
  } catch {
    return false;
  }
}

/** 删除整块 `proceduralStep`（含子步骤）。 */
export function deleteProceduralStepAtPos(
  editor: Editor,
  stepPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canDeleteProceduralStep(doc, stepPos)) return false;

  const resolved = resolveProceduralStepAtPos(doc, stepPos);
  if (!resolved) return false;

  const { step, stepPos: actualPos } = resolved;
  const $pos = doc.resolve(actualPos);
  const parent = $pos.parent;
  const isLastInMain =
    parent.type.name === "mainProcedure" &&
    countChildNodesOfType(parent, "proceduralStep") <= 1;
  const mainPos = isLastInMain ? $pos.before($pos.depth) : null;

  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      if (!dispatch) return true;

      tr.delete(actualPos, actualPos + step.nodeSize);

      if (mainPos != null) {
        const mappedMainPos = tr.mapping.map(mainPos);
        const main = tr.doc.nodeAt(mappedMainPos);
        if (
          main?.type.name === "mainProcedure" &&
          countChildNodesOfType(main, "proceduralStep") === 0
        ) {
          const defaultStep = buildMinimalProceduralStepNode(state.schema);
          if (!defaultStep) return false;
          const insertPos = mappedMainPos + main.nodeSize - 1;
          tr.insert(insertPos, defaultStep);
          const sel = selectionInProceduralStepTitle(tr.doc, insertPos);
          if (sel) tr.setSelection(sel);
        }
      }

      dispatch(tr);
      return true;
    })
    .run();
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

export function buildMinimalCloseRqmtsJson(
  schema: DescriptionSchema = getDescriptionSchema(),
): JSONContent {
  return buildMinimalCloseRqmtsJsonFromSchema(schema);
}

/** 按 `schema.procedure.content` 组装程序类 DM 最小合法 `doc` JSON。 */
export function buildEmptyProcedureDocJsonFromSchema(
  schema: DescriptionSchema,
): JSONContent {
  const declared = parseSchemaContentRuleTokens(schema.procedure?.content);
  const sectionTokens =
    declared.length > 0
      ? declared
      : ["preliminaryRqmts", "mainProcedure", "closeRqmts"];

  const content: JSONContent[] = [];
  for (const token of sectionTokens) {
    if (token === "preliminaryRqmts" && hasSchemaNode(schema, "preliminaryRqmts")) {
      content.push(buildMinimalPreliminaryRqmtsJsonFromSchema(schema));
    } else if (token === "mainProcedure" && hasSchemaNode(schema, "mainProcedure")) {
      content.push(buildMinimalMainProcedureJson());
    } else if (token === "closeRqmts" && hasSchemaNode(schema, "closeRqmts")) {
      content.push(buildMinimalCloseRqmtsJsonFromSchema(schema));
    }
  }

  if (content.length === 0) {
    content.push(buildMinimalPreliminaryRqmtsJsonFromSchema(schema));
  }

  return { type: "doc", content };
}

function hasSchemaNode(schema: DescriptionSchema, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

/** 程序类 DM 正文最小稿（`doc` 下为 `preliminaryRqmts mainProcedure closeRqmts`）。 */
export function buildEmptyProcedureDocJson(
  schema: DescriptionSchema = getDescriptionSchema(),
): JSONContent {
  return buildEmptyProcedureDocJsonFromSchema(schema);
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
