import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";

import { getTitleTextFromNode } from "./faultIsolationDefaultTitles";
import {
  allocateNextIsolationRefId,
  buildMinimalChoiceJson,
  buildMinimalIsolationProcedureEndJson,
  buildMinimalIsolationStepJson,
  buildYesNoAnswerJson,
  createIsolationRefIdAllocator,
} from "./faultIsolationInsert";
import { useIsolationFlowOverlayStore } from "../../store/isolationFlowOverlayStore";
import { layoutIsolationFlowGraph } from "./isolationFlowLayout";

export const ISOLATION_FLOW_CHANNEL = "ietm-isolation-flow";
export const ISOLATION_FLOW_STORAGE_PREFIX = "ietm-isolation-flow:";

export type BranchMode = "是否分支" | "自定义分支";

export type IsolationFlowNodeDataPayload = {
  title: string;
  action: string;
  question?: string;
  branchMode?: BranchMode;
  customBranchOptions?: string[];
};

export type IsolationFlowNodePayload = {
  id: string;
  type: "isolationStep" | "isolationEnd";
  position: { x: number; y: number };
  data: IsolationFlowNodeDataPayload;
};

export type IsolationFlowEdgePayload = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export type IsolationFlowPayload = {
  version: 1;
  procedureKey: string;
  nodes: IsolationFlowNodePayload[];
  edges: IsolationFlowEdgePayload[];
};

export type IsolationFlowMessage =
  | { type: "SAVE"; payload: IsolationFlowPayload }
  | { type: "LOAD"; payload: IsolationFlowPayload };

export function makeProcedureKey(procedurePos: number): string {
  return `fi-${procedurePos}`;
}

export function parseProcedureKey(
  procedureKey: string,
): number | null {
  const m = /^fi-(\d+)$/.exec(procedureKey);
  if (!m) return null;
  return Number.parseInt(m[1], 10);
}

export function isolationFlowStorageKey(procedureKey: string): string {
  return `${ISOLATION_FLOW_STORAGE_PREFIX}${procedureKey}`;
}

function textToInlineContent(text: string): JSONContent[] {
  const t = text.trim();
  if (!t) return [];
  return [{ type: "text", text: t }];
}

function findChildByName(node: PMNode, childName: string): PMNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === childName) return child;
  }
  return null;
}

function getInlineTextFromBlock(node: PMNode, blockName: string): string {
  const block = findChildByName(node, blockName);
  if (!block) return "";
  return getInlineTextFromNode(block);
}

function getInlineTextFromNode(node: PMNode): string {
  let text = "";
  node.descendants((n) => {
    if (n.isText) text += n.text ?? "";
  });
  return text.trim();
}

function findIsolationMainProcedure(
  procedure: PMNode,
): PMNode | null {
  let main: PMNode | null = null;
  procedure.forEach((child) => {
    if (child.type.name !== "isolationProcedure") return;
    child.forEach((inner) => {
      if (inner.type.name === "isolationMainProcedure") {
        main = inner;
      }
    });
  });
  return main;
}

function forEachMainProcedureChild(
  procedurePos: number,
  procedure: PMNode,
  fn: (child: PMNode, childPos: number) => void,
): void {
  let offset = procedurePos + 1;
  for (let i = 0; i < procedure.childCount; i++) {
    const child = procedure.child(i);
    if (child.type.name === "isolationProcedure") {
      let innerOff = offset + 1;
      for (let j = 0; j < child.childCount; j++) {
        const inner = child.child(j);
        if (inner.type.name === "isolationMainProcedure") {
          let stepOff = innerOff + 1;
          for (let k = 0; k < inner.childCount; k++) {
            const step = inner.child(k);
            fn(step, stepOff);
            stepOff += step.nodeSize;
          }
        }
        innerOff += inner.nodeSize;
      }
    }
    offset += child.nodeSize;
  }
}

/** 为缺少 `stp-xxxx` 的步骤/结束块补全 id（打开编排器前）。 */
export function ensureIsolationRefIdsInProcedure(
  editor: Editor,
  procedurePos: number,
): void {
  const proc = editor.state.doc.nodeAt(procedurePos);
  if (!proc || proc.type.name !== "faultIsolationProcedure") return;

  let tr = editor.state.tr;
  let changed = false;
  const allocate = createIsolationRefIdAllocator(editor.state.doc);

  forEachMainProcedureChild(procedurePos, proc, (child, childPos) => {
    if (
      child.type.name !== "isolationStep" &&
      child.type.name !== "isolationProcedureEnd"
    ) {
      return;
    }
    const id = String(child.attrs.id ?? "").trim();
    if (/^stp-\d+$/i.test(id)) return;
    const nextId = allocate();
    tr = tr.setNodeMarkup(childPos, undefined, {
      ...child.attrs,
      id: nextId,
    });
    changed = true;
  });

  if (changed) {
    editor.view.dispatch(tr);
  }
}

function readStepBranch(
  step: PMNode,
): Pick<
  IsolationFlowNodeDataPayload,
  "branchMode" | "customBranchOptions"
> & {
  yesRef: string;
  noRef: string;
  choiceRefs: Array<{ text: string; ref: string }>;
} {
  const answer = findChildByName(step, "isolationStepAnswer");

  const empty = {
    branchMode: "是否分支" as BranchMode,
    customBranchOptions: [""],
    yesRef: "",
    noRef: "",
    choiceRefs: [] as Array<{ text: string; ref: string }>,
  };

  if (!answer?.firstChild) return empty;

  const branch = answer.firstChild;
  if (branch.type.name === "yesNoAnswer") {
    let yesRef = "";
    let noRef = "";
    branch.forEach((c) => {
      if (c.type.name === "yesAnswer") {
        yesRef = String(c.attrs.nextActionRefId ?? "").trim();
      } else if (c.type.name === "noAnswer") {
        noRef = String(c.attrs.nextActionRefId ?? "").trim();
      }
    });
    return {
      branchMode: "是否分支",
      customBranchOptions: undefined,
      yesRef,
      noRef,
      choiceRefs: [],
    };
  }

  if (branch.type.name === "listOfChoices") {
    const choiceRefs: Array<{ text: string; ref: string }> = [];
    branch.forEach((c) => {
      if (c.type.name !== "choice") return;
      choiceRefs.push({
        text: getInlineTextFromNode(c),
        ref: String(c.attrs.nextActionRefId ?? "").trim(),
      });
    });
    return {
      branchMode: "自定义分支",
      customBranchOptions:
        choiceRefs.length > 0
          ? choiceRefs.map((c) => c.text)
          : [""],
      yesRef: "",
      noRef: "",
      choiceRefs,
    };
  }

  return empty;
}

/** `isolationMainProcedure` → 编排器图数据。 */
export function procedureToFlow(main: PMNode): {
  nodes: IsolationFlowNodePayload[];
  edges: IsolationFlowEdgePayload[];
} {
  const nodes: IsolationFlowNodePayload[] = [];
  const edges: IsolationFlowEdgePayload[] = [];
  const nodeIds = new Set<string>();

  let index = 0;
  main.forEach((child) => {
    const refId = String(child.attrs.id ?? "").trim() || `tmp-${index}`;
    index += 1;

    if (child.type.name === "isolationStep") {
      const titleNode = findChildByName(child, "title");
      const branch = readStepBranch(child);
      nodes.push({
        id: refId,
        type: "isolationStep",
        position: { x: 0, y: 0 },
        data: {
          title: getTitleTextFromNode(titleNode),
          action: getInlineTextFromBlock(child, "action"),
          question: getInlineTextFromBlock(child, "isolationStepQuestion"),
          branchMode: branch.branchMode,
          customBranchOptions: branch.customBranchOptions,
        },
      });
      nodeIds.add(refId);

      if (branch.branchMode === "是否分支") {
        if (branch.yesRef && nodeIds.has(branch.yesRef) === false) {
          // target may appear later in list
        }
        if (branch.yesRef) {
          edges.push({
            id: `e-${refId}-yes-${branch.yesRef}`,
            source: refId,
            target: branch.yesRef,
            sourceHandle: "branch-yes",
          });
        }
        if (branch.noRef) {
          edges.push({
            id: `e-${refId}-no-${branch.noRef}`,
            source: refId,
            target: branch.noRef,
            sourceHandle: "branch-no",
          });
        }
      } else {
        branch.choiceRefs.forEach((choice, choiceIndex) => {
          if (!choice.ref) return;
          edges.push({
            id: `e-${refId}-c${choiceIndex}-${choice.ref}`,
            source: refId,
            target: choice.ref,
            sourceHandle: `branch-custom-${choiceIndex}`,
          });
        });
      }
    } else if (child.type.name === "isolationProcedureEnd") {
      const titleNode = findChildByName(child, "title");
      nodes.push({
        id: refId,
        type: "isolationEnd",
        position: { x: 0, y: 0 },
        data: {
          title: getTitleTextFromNode(titleNode),
          action: getInlineTextFromBlock(child, "action"),
        },
      });
      nodeIds.add(refId);
    }
  });

  // 过滤指向尚未收集的 id 的边（无效引用）
  const allIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => allIds.has(e.source) && allIds.has(e.target),
  );

  return { nodes, edges: validEdges };
}

/** 合并 sessionStorage 中的节点坐标；无缓存或新节点用 Dagre 补全。 */
export function mergeSessionLayoutIntoFlow(
  procedureKey: string,
  nodes: IsolationFlowNodePayload[],
  edges: IsolationFlowEdgePayload[],
): IsolationFlowNodePayload[] {
  const cached = readIsolationFlowPayload(procedureKey);
  if (
    !cached ||
    cached.procedureKey !== procedureKey ||
    !cached.nodes?.length
  ) {
    return layoutIsolationFlowGraph(nodes, edges);
  }

  const positionById = new Map(
    cached.nodes.map((n) => [n.id, n.position] as const),
  );

  const hasUncached = nodes.some((n) => !positionById.has(n.id));
  const laidMap = hasUncached
    ? new Map(
        layoutIsolationFlowGraph(nodes, edges).map((n) => [
          n.id,
          n.position,
        ]),
      )
    : null;

  return nodes.map((n) => {
    const cachedPos = positionById.get(n.id);
    if (cachedPos) return { ...n, position: cachedPos };
    const autoPos = laidMap?.get(n.id);
    return autoPos ? { ...n, position: autoPos } : n;
  });
}

function buildRefIdMap(
  editor: Editor,
  flowNodes: IsolationFlowNodePayload[],
): Map<string, string> {
  const map = new Map<string, string>();
  const reservedStpIds: string[] = [];

  for (const node of flowNodes) {
    const id = node.id.trim();
    if (/^stp-\d+$/i.test(id)) {
      map.set(node.id, id);
      reservedStpIds.push(id);
    }
  }

  const allocate = createIsolationRefIdAllocator(
    editor.state.doc,
    reservedStpIds,
  );

  for (const node of flowNodes) {
    if (map.has(node.id)) continue;
    map.set(node.id, allocate());
  }

  return map;
}

function resolveTargetRef(
  refMap: Map<string, string>,
  flowNodeId: string,
): string {
  return refMap.get(flowNodeId) ?? "";
}

function patchTitleAction(
  base: JSONContent,
  title: string,
  action: string,
  question?: string,
): JSONContent {
  const content = (base.content ?? []).map((child) => {
    if (child.type === "title") {
      return { ...child, content: textToInlineContent(title) };
    }
    if (child.type === "action") {
      return { ...child, content: textToInlineContent(action) };
    }
    if (child.type === "isolationStepQuestion" && question !== undefined) {
      return { ...child, content: textToInlineContent(question) };
    }
    return child;
  });
  return { ...base, content };
}

function buildStepAnswerJson(
  flowNode: IsolationFlowNodePayload,
  edges: IsolationFlowEdgePayload[],
  refMap: Map<string, string>,
): JSONContent {
  const branchMode: BranchMode =
    flowNode.data.branchMode ?? "是否分支";
  const flowId = flowNode.id;

  if (branchMode === "自定义分支") {
    const options = flowNode.data.customBranchOptions ?? [""];
    const choices: JSONContent[] = options.map((text, index) => {
      const edge = edges.find(
        (e) =>
          e.source === flowId &&
          (e.sourceHandle ?? null) === `branch-custom-${index}`,
      );
      const nextRef = edge ? resolveTargetRef(refMap, edge.target) : "";
      return {
        type: "choice",
        attrs: { nextActionRefId: nextRef },
        content: textToInlineContent(text),
      };
    });
    if (choices.length === 0) {
      choices.push(buildMinimalChoiceJson());
    }
    return {
      type: "isolationStepAnswer",
      content: [{ type: "listOfChoices", content: choices }],
    };
  }

  const yesEdge = edges.find(
    (e) =>
      e.source === flowId && (e.sourceHandle ?? null) === "branch-yes",
  );
  const noEdge = edges.find(
    (e) =>
      e.source === flowId && (e.sourceHandle ?? null) === "branch-no",
  );
  const yesRef = yesEdge ? resolveTargetRef(refMap, yesEdge.target) : "";
  const noRef = noEdge ? resolveTargetRef(refMap, noEdge.target) : "";

  return {
    type: "isolationStepAnswer",
    content: [buildYesNoAnswerJson(yesRef, noRef)],
  };
}

function flowToMainProcedureContent(
  editor: Editor,
  payload: IsolationFlowPayload,
): JSONContent[] {
  const refMap = buildRefIdMap(editor, payload.nodes);
  const out: JSONContent[] = [];

  for (const flowNode of payload.nodes) {
    const refId = refMap.get(flowNode.id) ?? allocateNextIsolationRefId(editor);

    if (flowNode.type === "isolationStep") {
      let step = buildMinimalIsolationStepJson(refId);
      step = patchTitleAction(
        step,
        flowNode.data.title,
        flowNode.data.action,
        flowNode.data.question ?? "",
      );
      const answerJson = buildStepAnswerJson(
        flowNode,
        payload.edges,
        refMap,
      );
      step = {
        ...step,
        content: (step.content ?? []).map((c) =>
          c.type === "isolationStepAnswer" ? answerJson : c,
        ),
      };
      out.push(step);
    } else if (flowNode.type === "isolationEnd") {
      let end = buildMinimalIsolationProcedureEndJson(refId);
      end = patchTitleAction(
        end,
        flowNode.data.title,
        flowNode.data.action,
      );
      out.push(end);
    }
  }

  if (out.length === 0) {
    out.push(buildMinimalIsolationStepJson(allocateNextIsolationRefId(editor)));
  }

  return out;
}

/** 将编排器结果写回指定 `faultIsolationProcedure`。 */
export function applyIsolationFlowToEditor(
  editor: Editor,
  payload: IsolationFlowPayload,
): boolean {
  const procedurePos = parseProcedureKey(payload.procedureKey);
  if (procedurePos == null) return false;

  const proc = editor.state.doc.nodeAt(procedurePos);
  if (!proc || proc.type.name !== "faultIsolationProcedure") return false;

  let mainPos: number | null = null;
  let main: PMNode | null = null;

  let offset = procedurePos + 1;
  for (let i = 0; i < proc.childCount; i++) {
    const child = proc.child(i);
    if (child.type.name === "isolationProcedure") {
      let innerOff = offset + 1;
      for (let j = 0; j < child.childCount; j++) {
        const inner = child.child(j);
        if (inner.type.name === "isolationMainProcedure") {
          mainPos = innerOff;
          main = inner;
        }
        innerOff += inner.nodeSize;
      }
    }
    offset += child.nodeSize;
  }

  if (mainPos == null || !main) return false;

  const childrenJson = flowToMainProcedureContent(editor, payload);
  const newChildren = childrenJson.map((json) =>
    editor.schema.nodeFromJSON(json),
  );
  const fragment = Fragment.from(newChildren);

  const from = mainPos + 1;
  const to = mainPos + main.nodeSize - 1;
  const tr = editor.state.tr.replaceWith(from, to, fragment);
  editor.view.dispatch(tr);
  return true;
}

/** 从编辑器构建隔离流程编排器 payload；失败时返回 `null`。 */
export function buildIsolationFlowPayload(
  editor: Editor,
  procedurePos: number,
): IsolationFlowPayload | null {
  const proc = editor.state.doc.nodeAt(procedurePos);
  if (!proc || proc.type.name !== "faultIsolationProcedure") return null;

  ensureIsolationRefIdsInProcedure(editor, procedurePos);

  const procAfter = editor.state.doc.nodeAt(procedurePos);
  if (!procAfter) return null;

  const main = findIsolationMainProcedure(procAfter);
  if (!main) return null;

  const procedureKey = makeProcedureKey(procedurePos);
  const { nodes, edges } = procedureToFlow(main);
  const nodesWithLayout = mergeSessionLayoutIntoFlow(
    procedureKey,
    nodes,
    edges,
  );
  return {
    version: 1,
    procedureKey,
    nodes: nodesWithLayout,
    edges,
  };
}

export function openIsolationFlowEditor(
  editor: Editor,
  procedurePos: number,
): void {
  const flowPayload = buildIsolationFlowPayload(editor, procedurePos);
  if (!flowPayload) return;

  useIsolationFlowOverlayStore
    .getState()
    .open(flowPayload, editor.isEditable);
}

export function readIsolationFlowPayload(
  procedureKey: string,
): IsolationFlowPayload | null {
  try {
    const raw = sessionStorage.getItem(
      isolationFlowStorageKey(procedureKey),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IsolationFlowPayload;
    if (
      parsed?.version !== 1 ||
      parsed.procedureKey !== procedureKey ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeIsolationFlowPayload(
  payload: IsolationFlowPayload,
): void {
  try {
    sessionStorage.setItem(
      isolationFlowStorageKey(payload.procedureKey),
      JSON.stringify(payload),
    );
  } catch {
    // 忽略 quota / 隐私模式等写入失败
  }
}

export function payloadFromFlowSnapshot(
  procedureKey: string,
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: IsolationFlowNodeDataPayload;
  }>,
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
  }>,
): IsolationFlowPayload {
  return {
    version: 1,
    procedureKey,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type === "isolationEnd" ? "isolationEnd" : "isolationStep",
      position: n.position,
      data: {
        title: n.data.title,
        action: n.data.action,
        question: n.data.question,
        branchMode: n.data.branchMode,
        customBranchOptions: n.data.customBranchOptions,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
    })),
  };
}
