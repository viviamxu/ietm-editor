import { mergeAttributes, Node } from "@tiptap/core";
import { imeSafeReactNodeViewRenderer } from "../../lib/editor/imeSafeReactNodeViewRenderer";

import { s1000dIdAttributeConfig } from "../../lib/s1000d/s1000dIdAttribute";
import {
  ChoiceNodeView,
  ListOfChoicesNodeView,
  FaultDescrNodeView,
  FaultIsolationProcedureNodeView,
  HiddenAtomNodeView,
  HiddenFaultNodeView,
  IsolationActionNodeView,
  IsolationProcedureEndNodeView,
  IsolationMainProcedureNodeView,
  IsolationProcedureNodeView,
  IsolationStepAnswerNodeView,
  IsolationStepNodeView,
  IsolationStepQuestionNodeView,
} from "./FaultIsolationNodeViews";

function readAttr(el: Element, name: string): string | null {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase());
}

function nextActionRefIdSpec() {
  return {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => readAttr(el, "nextActionRefId"),
    renderHTML: (attrs: { nextActionRefId?: string | null }) => {
      const v = attrs.nextActionRefId;
      if (v == null || String(v).trim() === "") return {};
      return { nextActionRefId: String(v).trim() };
    },
  };
}

/** 编辑器内缓存「是否 / 选择」另一套答案子树 JSON，不参与 S1000D XML 导出。 */
function editorAnswerBranchCacheAttr(
  attrKey: "cachedYesNoAnswerJson" | "cachedListOfChoicesJson",
  dataAttr: string,
) {
  return {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => {
      const v = el.getAttribute(dataAttr);
      return v != null && v.trim() !== "" ? v : null;
    },
    renderHTML: (attrs: Record<string, string | null | undefined>) => {
      const v = attrs[attrKey];
      if (v == null || String(v).trim() === "") return {};
      return { [dataAttr]: String(v) };
    },
  };
}

/** 故障码空元素 `<fault faultCode="…"/>` */
export const S1000DFault = Node.create({
  name: "fault",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      faultCode: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => readAttr(el, "faultCode"),
        renderHTML: (attrs: { faultCode?: string | null }) => {
          const v = attrs.faultCode;
          if (v == null || String(v).trim() === "") return {};
          return { faultCode: String(v).trim() };
        },
      },
    };
  },
  parseHTML: () => [{ tag: "fault" }],
  renderHTML({ HTMLAttributes }) {
    return ["fault", mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(HiddenFaultNodeView);
  },
});

export const S1000DFaultDescr = Node.create({
  name: "faultDescr",
  group: "block",
  content: "descr",
  parseHTML: () => [{ tag: "faultdescr" }, { tag: "faultDescr" }],
  renderHTML({ HTMLAttributes }) {
    return ["faultDescr", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(FaultDescrNodeView);
  },
});

export const S1000DDescr = Node.create({
  name: "descr",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "descr" }],
  renderHTML({ HTMLAttributes }) {
    return ["descr", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DIsolationProcedure = Node.create({
  name: "isolationProcedure",
  group: "block",
  content: "isolationMainProcedure",
  parseHTML: () => [
    { tag: "isolationprocedure" },
    { tag: "isolationProcedure" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationProcedure", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationProcedureNodeView);
  },
});

export const S1000DIsolationMainProcedure = Node.create({
  name: "isolationMainProcedure",
  group: "block",
  content: "(isolationStep|isolationProcedureEnd)+",
  parseHTML: () => [
    { tag: "isolationmainprocedure" },
    { tag: "isolationMainProcedure" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationMainProcedure", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationMainProcedureNodeView);
  },
});

export const S1000DAction = Node.create({
  name: "action",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "action" }],
  renderHTML({ HTMLAttributes }) {
    return ["action", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationActionNodeView);
  },
});

export const S1000DIsolationStepQuestion = Node.create({
  name: "isolationStepQuestion",
  group: "block",
  content: "inline*",
  parseHTML: () => [
    { tag: "isolationstepquestion" },
    { tag: "isolationStepQuestion" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationStepQuestion", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationStepQuestionNodeView);
  },
});

export const S1000DYesAnswer = Node.create({
  name: "yesAnswer",
  group: "block",
  atom: true,
  addAttributes() {
    return { nextActionRefId: nextActionRefIdSpec() };
  },
  parseHTML: () => [{ tag: "yesanswer" }, { tag: "yesAnswer" }],
  renderHTML({ HTMLAttributes }) {
    return ["yesAnswer", mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(HiddenAtomNodeView);
  },
});

export const S1000DNoAnswer = Node.create({
  name: "noAnswer",
  group: "block",
  atom: true,
  addAttributes() {
    return { nextActionRefId: nextActionRefIdSpec() };
  },
  parseHTML: () => [{ tag: "noanswer" }, { tag: "noAnswer" }],
  renderHTML({ HTMLAttributes }) {
    return ["noAnswer", mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(HiddenAtomNodeView);
  },
});

export const S1000DYesNoAnswer = Node.create({
  name: "yesNoAnswer",
  group: "block",
  content: "yesAnswer noAnswer",
  parseHTML: () => [{ tag: "yesnoanswer" }, { tag: "yesNoAnswer" }],
  renderHTML({ HTMLAttributes }) {
    return ["yesNoAnswer", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DChoice = Node.create({
  name: "choice",
  group: "block",
  content: "inline*",
  addAttributes() {
    return {
      id: s1000dIdAttributeConfig(),
      nextActionRefId: nextActionRefIdSpec(),
    };
  },
  parseHTML: () => [{ tag: "choice" }],
  renderHTML({ HTMLAttributes }) {
    return ["choice", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(ChoiceNodeView);
  },
});

export const S1000DListOfChoices = Node.create({
  name: "listOfChoices",
  group: "block",
  content: "choice+",
  parseHTML: () => [
    { tag: "listofchoices" },
    { tag: "listOfChoices" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["listOfChoices", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(ListOfChoicesNodeView);
  },
});

export const S1000DIsolationStepAnswer = Node.create({
  name: "isolationStepAnswer",
  group: "block",
  content: "yesNoAnswer | listOfChoices",
  addAttributes() {
    return {
      cachedYesNoAnswerJson: editorAnswerBranchCacheAttr(
        "cachedYesNoAnswerJson",
        "data-editor-cached-yes-no",
      ),
      cachedListOfChoicesJson: editorAnswerBranchCacheAttr(
        "cachedListOfChoicesJson",
        "data-editor-cached-choices",
      ),
    };
  },
  parseHTML: () => [
    { tag: "isolationstepanswer" },
    { tag: "isolationStepAnswer" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationStepAnswer", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationStepAnswerNodeView);
  },
});

export const S1000DIsolationStep = Node.create({
  name: "isolationStep",
  group: "block",
  content: "title? action isolationStepQuestion isolationStepAnswer",
  addAttributes() {
    return { id: s1000dIdAttributeConfig() };
  },
  parseHTML: () => [
    {
      tag: "isolationstep",
      getAttrs: (el) =>
        el instanceof Element
          ? { id: readAttr(el, "id") }
          : {},
    },
    {
      tag: "isolationStep",
      getAttrs: (el) =>
        el instanceof Element
          ? { id: readAttr(el, "id") }
          : {},
    },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationStep", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationStepNodeView);
  },
});

export const S1000DIsolationProcedureEnd = Node.create({
  name: "isolationProcedureEnd",
  group: "block",
  content: "title? action",
  addAttributes() {
    return { id: s1000dIdAttributeConfig() };
  },
  parseHTML: () => [
    {
      tag: "isolationprocedureend",
      getAttrs: (el) =>
        el instanceof Element
          ? { id: readAttr(el, "id") }
          : {},
    },
    {
      tag: "isolationProcedureEnd",
      getAttrs: (el) =>
        el instanceof Element
          ? { id: readAttr(el, "id") }
          : {},
    },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["isolationProcedureEnd", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(IsolationProcedureEndNodeView);
  },
});

export const S1000DFaultIsolationProcedure = Node.create({
  name: "faultIsolationProcedure",
  group: "block",
  content: "fault faultDescr isolationProcedure",
  parseHTML: () => [
    { tag: "faultisolationprocedure" },
    { tag: "faultIsolationProcedure" },
  ],
  renderHTML({ HTMLAttributes }) {
    return ["faultIsolationProcedure", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(FaultIsolationProcedureNodeView);
  },
});

/** 故障隔离类节点（子类型先于容器注册）。 */
export const s1000dFaultIsolationNodes = [
  S1000DFault,
  S1000DDescr,
  S1000DFaultDescr,
  S1000DAction,
  S1000DIsolationStepQuestion,
  S1000DYesAnswer,
  S1000DNoAnswer,
  S1000DYesNoAnswer,
  S1000DChoice,
  S1000DListOfChoices,
  S1000DIsolationStepAnswer,
  S1000DIsolationStep,
  S1000DIsolationProcedureEnd,
  S1000DIsolationMainProcedure,
  S1000DIsolationProcedure,
  S1000DFaultIsolationProcedure,
] as const;
