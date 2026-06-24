import type { Editor, JSONContent } from "@tiptap/core";
import { Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import type { DescriptionSchema } from "../../types/descriptionSchema";

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

/** 在最近的 `crewDrill` / `crewDrillStep` / 条件块末尾插入 `if` / `elseIf` / `case`。 */
export function insertCrewConditionAtCursor(
  editor: Editor,
  type: "if" | "elseIf" | "case",
): boolean {
  const nodeType = editor.state.schema.nodes[type];
  if (!nodeType) return false;

  return insertCrewBlockAtCursor(
    editor,
    buildMinimalCrewConditionJson(type),
    selectionInCaseCond,
    (_editor, $from, child) => {
      if (child.type !== nodeType) return null;

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

/** 在最近的 `crewDrillStep` 正文区插入 `challengeAndResponse`（位于条件分支之前）。 */
export function insertChallengeAndResponseAtCursor(editor: Editor): boolean {
  const carType = editor.state.schema.nodes.challengeAndResponse;
  if (!carType) return false;

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
