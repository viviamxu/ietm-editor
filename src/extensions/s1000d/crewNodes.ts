import { mergeAttributes, Node } from "@tiptap/core";
import { imeSafeReactNodeViewRenderer } from "../../lib/editor/imeSafeReactNodeViewRenderer";

import {
  SOURCE_XML_ATTR_KEYS,
  xmlAttrsPresentOnElement,
} from "../../lib/s1000d/sourceXmlAttrKeys";
import {
  CaseCondNodeView,
  ChallengeAndResponseNodeView,
  ChallengeRowNodeView,
  CrewConditionNodeView,
  CrewDrillNodeView,
  CrewDrillStepNodeView,
  CrewRefCardNodeView,
  DescrCrewNodeView,
  ResponseRowNodeView,
} from "./CrewNodeViews";

function tagRules(tag: string) {
  const lower = tag.toLowerCase();
  return [{ tag: lower }, { tag }];
}

function blockTagParseRules(tag: string) {
  const lower = tag.toLowerCase();
  const readId = (el: Element) =>
    el.getAttribute("id") ?? el.getAttribute("data-s1000d-element-id");

  return [
    {
      tag: lower,
      getAttrs: (el: unknown) => {
        if (!(el instanceof Element)) return false;
        return {
          id: readId(el),
          [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ["id"]),
        };
      },
    },
    { tag },
  ];
}

const CREW_REF_CARD_GROUP = "block";
const CREW_INNER_GROUP = "crewInnerBlock";
const CREW_STEP_GROUP = "crewStepBlock";
const CREW_CONDITION_GROUP = "crewConditionBlock";
const CREW_CAR_INNER_GROUP = "crewCarInnerBlock";

const CREW_DRILL_BODY =
  "(title?) (warning | caution | note | para | fmftElemGroup)*";
const CREW_STEP_BODY =
  "(warning | caution | note | para | fmftElemGroup | challengeAndResponse)*";
const CREW_CONDITION_TAIL = "(crewDrillStep | if | elseIf | case)*";

/** 编辑器内缓存另一操作类正文模式 JSON，不参与 S1000D XML 导出。 */
function editorCrewBranchCacheAttr(
  attrKey: "cachedCrewRefCardJson" | "cachedDescrCrewJson",
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

const CREW_MODE_CACHE_ATTRS = {
  cachedCrewRefCardJson: editorCrewBranchCacheAttr(
    "cachedCrewRefCardJson",
    "data-editor-cached-crew-ref-card",
  ),
  cachedDescrCrewJson: editorCrewBranchCacheAttr(
    "cachedDescrCrewJson",
    "data-editor-cached-descr-crew",
  ),
};

export const S1000DCaseCond = Node.create({
  name: "caseCond",
  group: "block",
  content: "inline*",
  parseHTML: () => tagRules("caseCond"),
  renderHTML({ HTMLAttributes }) {
    return ["caseCond", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(CaseCondNodeView);
  },
});

export const S1000DChallenge = Node.create({
  name: "challenge",
  group: CREW_CAR_INNER_GROUP,
  content: "(para | fmftElemGroup)*",
  defining: true,
  parseHTML: () => tagRules("challenge"),
  renderHTML({ HTMLAttributes }) {
    return ["challenge", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(ChallengeRowNodeView);
  },
});

export const S1000DResponse = Node.create({
  name: "response",
  group: CREW_CAR_INNER_GROUP,
  content: "(para | fmftElemGroup)*",
  defining: true,
  parseHTML: () => tagRules("response"),
  renderHTML({ HTMLAttributes }) {
    return ["response", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(ResponseRowNodeView);
  },
});

export const S1000DChallengeAndResponse = Node.create({
  name: "challengeAndResponse",
  group: CREW_STEP_GROUP,
  content: "challenge response+",
  defining: true,
  parseHTML: () => blockTagParseRules("challengeAndResponse"),
  renderHTML({ HTMLAttributes }) {
    return ["challengeAndResponse", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(ChallengeAndResponseNodeView);
  },
});

function createCrewConditionNode(name: "if" | "elseIf" | "case") {
  return Node.create({
    name,
    group: CREW_CONDITION_GROUP,
    content: `caseCond ${CREW_CONDITION_TAIL}`,
    defining: true,
    isolating: true,
    parseHTML: () => blockTagParseRules(name),
    renderHTML({ HTMLAttributes }) {
      return [name, mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return imeSafeReactNodeViewRenderer(CrewConditionNodeView);
    },
  });
}

export const S1000DIf = createCrewConditionNode("if");
export const S1000DElseIf = createCrewConditionNode("elseIf");
export const S1000DCase = createCrewConditionNode("case");

export const S1000DCrewDrillStep = Node.create({
  name: "crewDrillStep",
  group: CREW_STEP_GROUP,
  content: `title? ${CREW_STEP_BODY} ${CREW_CONDITION_TAIL}`,
  defining: true,
  isolating: true,
  parseHTML: () => blockTagParseRules("crewDrillStep"),
  renderHTML({ HTMLAttributes }) {
    return ["crewDrillStep", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(CrewDrillStepNodeView);
  },
});

export const S1000DCrewDrill = Node.create({
  name: "crewDrill",
  group: CREW_INNER_GROUP,
  content: `${CREW_DRILL_BODY} (crewDrillStep | if | elseIf | case)*`,
  defining: true,
  parseHTML: () => blockTagParseRules("crewDrill"),
  renderHTML({ HTMLAttributes }) {
    return ["crewDrill", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(CrewDrillNodeView);
  },
});

export const S1000DCrewRefCard = Node.create({
  name: "crewRefCard",
  group: CREW_REF_CARD_GROUP,
  content: `(title?) (para | warning | caution | note | fmftElemGroup)* crewDrill+`,
  defining: true,
  addAttributes() {
    return {
      cachedDescrCrewJson: CREW_MODE_CACHE_ATTRS.cachedDescrCrewJson,
    };
  },
  parseHTML: () => blockTagParseRules("crewRefCard"),
  renderHTML({ HTMLAttributes }) {
    return ["crewRefCard", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(CrewRefCardNodeView);
  },
});

export const S1000DDescrCrew = Node.create({
  name: "descrCrew",
  group: CREW_REF_CARD_GROUP,
  content: `(warning | caution | note | levelledPara | fmftElemGroup)*`,
  defining: true,
  addAttributes() {
    return {
      cachedCrewRefCardJson: CREW_MODE_CACHE_ATTRS.cachedCrewRefCardJson,
    };
  },
  parseHTML: () => blockTagParseRules("descrCrew"),
  renderHTML({ HTMLAttributes }) {
    return ["descrCrew", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(DescrCrewNodeView);
  },
});

/** 操作类节点（子类型先于容器注册）。 */
export const s1000dCrewNodes = [
  S1000DCaseCond,
  S1000DChallenge,
  S1000DResponse,
  S1000DChallengeAndResponse,
  S1000DIf,
  S1000DElseIf,
  S1000DCase,
  S1000DCrewDrillStep,
  S1000DCrewDrill,
  S1000DCrewRefCard,
  S1000DDescrCrew,
] as const;
