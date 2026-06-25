import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import { canInsertCrewStepLevelBlockAtCursor } from "./crewChallengeContext";
import {
  buildInsertCautionJson,
  buildInsertLevelledParaJson,
  buildInsertNoteJson,
  buildInsertWarningJson,
  DESCR_CREW_ATTENTION_INSERT_OPTIONS,
} from "./descriptionSchemaInsert";

export type CrewContentMode = "crewRefCard" | "descrCrew";

const CREW_CONDITION_HOSTS = new Set([
  "crewDrill",
  "crewDrillStep",
  "if",
  "elseIf",
  "case",
]);

const CREW_STEP_TAIL_TYPES = new Set([
  "crewDrillStep",
  "if",
  "elseIf",
  "case",
]);

export {
  canInsertCrewStepLevelBlockAtCursor,
  isInsideCrewChallengeAndResponse,
} from "./crewChallengeContext";

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

/** 描述类操作（`descrCrew`）最小空稿：warning、caution、note、levelledPara 各一块（attention 仅引导文，无默认列表）。 */
export function buildMinimalDescrCrewJson(
  schema: DescriptionSchema,
): JSONContent {
  const content: JSONContent[] = [];

  for (const build of [
    buildInsertWarningJson,
    buildInsertCautionJson,
    buildInsertNoteJson,
  ]) {
    const node = build(schema, DESCR_CREW_ATTENTION_INSERT_OPTIONS);
    if (node) content.push(node);
  }

  const levelledPara =
    buildInsertLevelledParaJson(schema) ?? {
      type: "levelledPara",
      content: [
        { type: "title", content: [] },
        { type: "para", content: [] },
      ],
    };
  content.push(levelledPara);

  return { type: "descrCrew", content };
}

export function buildEmptyCrewDocJsonForMode(
  schema: DescriptionSchema,
  mode: CrewContentMode,
): JSONContent {
  const root =
    mode === "descrCrew"
      ? buildMinimalDescrCrewJson(schema)
      : buildMinimalCrewRefCardJson();
  return { type: "doc", content: [root] };
}

/** 操作类 DM 正文最小稿（默认 `crewRefCard`）。 */
export function buildEmptyCrewDocJsonFromSchema(
  schema: DescriptionSchema,
  mode: CrewContentMode = "crewRefCard",
): JSONContent {
  return buildEmptyCrewDocJsonForMode(schema, mode);
}

export function buildEmptyCrewDocJson(
  schema: DescriptionSchema,
): JSONContent {
  return buildEmptyCrewDocJsonFromSchema(schema);
}

export function buildMinimalCrewConditionJson(
  type: "if" | "elseIf" | "case",
): JSONContent {
  return {
    type,
    content: [{ type: "caseCond", content: [] }],
  };
}

export function buildMinimalChallengeAndResponseJson(): JSONContent {
  return {
    type: "challengeAndResponse",
    content: [
      { type: "challenge", content: [{ type: "para", content: [] }] },
      { type: "response", content: [{ type: "para", content: [] }] },
    ],
  };
}

function getInnermostConditionHostDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    if (CREW_CONDITION_HOSTS.has($from.node(d).type.name)) return d;
  }
  return -1;
}

function getInnermostCrewDrillStepDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "crewDrillStep") return d;
  }
  return -1;
}

function findNearestCrewDrill(
  editor: Editor,
): { drillPos: number; drill: PMNode } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "crewDrill") {
      return { drillPos: $from.before(d), drill: node };
    }
  }

  let found: { drillPos: number; drill: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "crewDrill") {
      found = { drillPos: pos, drill: node };
      return false;
    }
  });
  return found;
}

function selectionInCaseCond(
  doc: PMNode,
  nodePos: number,
): TextSelection | null {
  const node = doc.nodeAt(nodePos);
  if (!node) return null;

  let offset = nodePos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "caseCond") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  return null;
}

function selectionInChallengePara(
  doc: PMNode,
  carPos: number,
): TextSelection | null {
  const node = doc.nodeAt(carPos);
  if (!node || node.type.name !== "challengeAndResponse") return null;

  let offset = carPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name !== "challenge") {
      offset += child.nodeSize;
      continue;
    }

    let challengeOffset = offset + 1;
    for (let j = 0; j < child.childCount; j++) {
      const grandchild = child.child(j);
      if (grandchild.type.name === "para") {
        const caret = Math.min(challengeOffset + 1, doc.content.size);
        if (caret < 0 || caret > doc.content.size) return null;
        return TextSelection.create(doc, caret);
      }
      challengeOffset += grandchild.nodeSize;
    }
    offset += child.nodeSize;
  }
  return null;
}

function findCrewStepBodyInsertPos(step: PMNode, stepPos: number): number {
  let offset = stepPos + 1;
  for (let i = 0; i < step.childCount; i++) {
    const child = step.child(i);
    if (CREW_STEP_TAIL_TYPES.has(child.type.name)) {
      return offset;
    }
    offset += child.nodeSize;
  }
  return stepPos + step.nodeSize - 1;
}

function canInsertNodeAtParentIndex(
  parent: PMNode,
  insertIndex: number,
  child: PMNode,
): boolean {
  const siblings: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i === insertIndex) siblings.push(child);
    siblings.push(parent.child(i));
  }
  if (insertIndex === parent.childCount) siblings.push(child);
  return parent.type.validContent(Fragment.from(siblings));
}

/** 解析顶栏/光标插入 if / elseIf / case 的目标位置。 */
function resolveCrewConditionInsertPosAtCursor(
  editor: Editor,
  $from: ResolvedPos,
  type: "if" | "elseIf" | "case",
): number | null {
  if (!editor.state.schema.nodes[type]) return null;

  const hostDepth = getInnermostConditionHostDepth($from);
  if (hostDepth >= 0) {
    const host = $from.node(hostDepth);
    const hostPos = $from.before(hostDepth);
    return hostPos + host.nodeSize - 1;
  }

  const target = findNearestCrewDrill(editor);
  if (!target) return null;
  return target.drillPos + target.drill.nodeSize - 1;
}

/** elseIf 仅允许紧接在同级 if / elseIf 之后（S1000D `if elseIf*`）。 */
export function canInsertElseIfAtCursor(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!canInsertCrewStepLevelBlockAtCursor(editor)) return false;
  if (!editor.state.schema.nodes.elseIf) return false;

  const insertPos = resolveCrewConditionInsertPosAtCursor(
    editor,
    editor.state.selection.$from,
    "elseIf",
  );
  if (insertPos == null) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.state.schema,
      buildMinimalCrewConditionJson("elseIf"),
    );
  } catch {
    return false;
  }

  let $insert;
  try {
    $insert = editor.state.doc.resolve(insertPos);
  } catch {
    return false;
  }

  const insertIndex = $insert.index();
  if (insertIndex === 0) return false;

  const prev = $insert.parent.child(insertIndex - 1);
  if (prev.type.name !== "if" && prev.type.name !== "elseIf") return false;

  return canInsertNodeAtParentIndex($insert.parent, insertIndex, child);
}

function insertCrewBlockAtCursor(
  editor: Editor,
  json: JSONContent,
  selectAtPos: (doc: PMNode, pos: number) => TextSelection | null,
  resolveInsertPos: (
    editor: Editor,
    $from: ResolvedPos,
    child: PMNode,
  ) => number | null,
): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      let child: PMNode;
      try {
        child = PMNode.fromJSON(state.schema, json);
      } catch {
        return false;
      }

      const insertPos = resolveInsertPos(editor, state.selection.$from, child);
      if (insertPos == null) return false;

      const $insert = tr.doc.resolve(insertPos);
      if (!$insert.parent.type.validContent($insert.parent.content.addToEnd(child))) {
        return false;
      }

      if (!dispatch) return true;

      tr.insert(insertPos, child);
      const sel = selectAtPos(tr.doc, insertPos);
      if (sel) tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}

function selectionInCrewDrillStepTitle(
  doc: PMNode,
  stepPos: number,
): TextSelection | null {
  const node = doc.nodeAt(stepPos);
  if (!node || node.type.name !== "crewDrillStep") return null;

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

function resolveCrewDrillStepTitleEndSiblingInsertPos(
  $from: ResolvedPos,
): number | null {
  if ($from.parent.type.name !== "title") return null;
  if ($from.parentOffset !== $from.parent.content.size) return null;

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== "title") continue;
    const stepDepth = d - 1;
    if ($from.node(stepDepth).type.name !== "crewDrillStep") continue;
    const stepPos = $from.before(stepDepth);
    const step = $from.node(stepDepth);
    return stepPos + step.nodeSize;
  }
  return null;
}

function parentContentWithChildAt(
  parent: PMNode,
  insertIndex: number,
  child: PMNode,
): Fragment {
  const children: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i === insertIndex) children.push(child);
    children.push(parent.child(i));
  }
  if (insertIndex === parent.childCount) children.push(child);
  return Fragment.from(children);
}

/** 光标位于 `crewDrillStep > title` 末尾时，紧挨 `title` 后插入空 `para` 的位置。 */
function resolveCrewDrillStepTitleEndParaInsert(
  $from: ResolvedPos,
): { insertPos: number; insertIndex: number; stepDepth: number } | null {
  if ($from.parent.type.name !== "title") return null;
  if ($from.parentOffset !== $from.parent.content.size) return null;

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== "title") continue;
    const stepDepth = d - 1;
    if ($from.node(stepDepth).type.name !== "crewDrillStep") continue;

    const step = $from.node(stepDepth);
    const stepPos = $from.before(stepDepth);
    let insertPos = stepPos + 1;
    for (let i = 0; i < step.childCount; i++) {
      const child = step.child(i);
      if (child.type.name === "title") {
        return { insertPos: insertPos + child.nodeSize, insertIndex: i + 1, stepDepth };
      }
      insertPos += child.nodeSize;
    }
    return null;
  }
  return null;
}

/** `crewDrillStep` 的 `title` 末尾：在 `title` 下方插入空 `para` 并聚焦。 */
export function insertParaAfterCrewDrillStepTitle(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!editor.state.selection.empty) return false;

  const ctx = resolveCrewDrillStepTitleEndParaInsert(
    editor.state.selection.$from,
  );
  if (!ctx) return false;

  const paraType = editor.state.schema.nodes.para;
  if (!paraType) return false;

  const step = editor.state.selection.$from.node(ctx.stepDepth);
  const para = paraType.create();
  if (!step.type.validContent(parentContentWithChildAt(step, ctx.insertIndex, para))) {
    return false;
  }

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;

      tr.insert(ctx.insertPos, para);
      const cursorPos = Math.min(ctx.insertPos + 1, tr.doc.content.size);
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      dispatch(tr.scrollIntoView());
      return true;
    })
    .run();
}

/** 在最近的 `crewDrillStep` / `crewDrill` / 条件块末尾插入 `crewDrillStep`。 */
export function insertCrewDrillStepAtCursor(editor: Editor): boolean {
  const stepType = editor.state.schema.nodes.crewDrillStep;
  if (!stepType) return false;
  if (!canInsertCrewStepLevelBlockAtCursor(editor)) return false;

  return insertCrewBlockAtCursor(
    editor,
    buildMinimalCrewDrillStepJson(),
    selectionInCrewDrillStepTitle,
    (_editor, $from, child) => {
      if (child.type !== stepType) return null;

      const siblingPos = resolveCrewDrillStepTitleEndSiblingInsertPos($from);
      if (siblingPos != null) return siblingPos;

      const stepDepth = getInnermostCrewDrillStepDepth($from);
      if (stepDepth >= 0) {
        const host = $from.node(stepDepth);
        const hostPos = $from.before(stepDepth);
        return hostPos + host.nodeSize - 1;
      }

      const hostDepth = getInnermostConditionHostDepth($from);
      if (hostDepth >= 0) {
        const host = $from.node(hostDepth);
        const hostPos = $from.before(hostDepth);
        return hostPos + host.nodeSize - 1;
      }

      const target = findNearestCrewDrill(_editor);
      if (!target) return null;
      return target.drillPos + target.drill.nodeSize - 1;
    },
  );
}

/** 在最近的 `crewDrill` / `crewDrillStep` / 条件块末尾插入 `if` / `elseIf` / `case`。 */
export function insertCrewConditionAtCursor(
  editor: Editor,
  type: "if" | "elseIf" | "case",
): boolean {
  const nodeType = editor.state.schema.nodes[type];
  if (!nodeType) return false;
  if (!canInsertCrewStepLevelBlockAtCursor(editor)) return false;

  if (type === "elseIf" && !canInsertElseIfAtCursor(editor)) return false;

  return insertCrewBlockAtCursor(
    editor,
    buildMinimalCrewConditionJson(type),
    selectionInCaseCond,
    (_editor, $from, child) => {
      if (child.type !== nodeType) return null;
      return resolveCrewConditionInsertPosAtCursor(_editor, $from, type);
    },
  );
}

/** 在最近的 `crewDrillStep` 正文区插入 `challengeAndResponse`（位于条件分支之前）。 */
export function insertChallengeAndResponseAtCursor(editor: Editor): boolean {
  const carType = editor.state.schema.nodes.challengeAndResponse;
  if (!carType) return false;
  if (!canInsertCrewStepLevelBlockAtCursor(editor)) return false;

  return insertCrewBlockAtCursor(
    editor,
    buildMinimalChallengeAndResponseJson(),
    selectionInChallengePara,
    (_editor, $from, child) => {
      if (child.type !== carType) return null;

      const stepDepth = getInnermostCrewDrillStepDepth($from);
      if (stepDepth < 0) return null;

      const step = $from.node(stepDepth);
      const stepPos = $from.before(stepDepth);
      return findCrewStepBodyInsertPos(step, stepPos);
    },
  );
}
