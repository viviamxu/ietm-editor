import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
  CloseRqmtsNodeView,
  MainProcedureNodeView,
  PreliminaryRqmtsNodeView,
  ProcedureEmptyPlaceholderNodeView,
  ProceduralStepNodeView,
  ReqCondNoRefNodeView,
  ReqGroupNodeView,
} from "./ProcedureNodeViews";
import {
  PersonnelNodeView,
  ReqPersonsNodeView,
} from "./ReqPersonsNodeViews";
import {
  SupportEquipDescrGroupNodeView,
  SupportEquipDescrNodeView,
  SpareDescrGroupNodeView,
  SpareDescrNodeView,
  SupplyDescrGroupNodeView,
  SupplyDescrNodeView,
} from "./SupportEquipNodeViews";
import {
  SOURCE_XML_ATTR_KEYS,
  xmlAttrsPresentOnElement,
} from "../../lib/s1000d/sourceXmlAttrKeys";

function readAttr(el: Element, name: string): string | null {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase());
}

function attrSpec(name: string) {
  return {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => readAttr(el, name),
    renderHTML: (attrs: Record<string, string | null | undefined>) => {
      const v = attrs[name];
      if (v == null || String(v).trim() === "") return {};
      return { [name]: String(v).trim() };
    },
  };
}

const PROCEDURE_SECTION_GROUP = "block";
const PROCEDURE_INNER_GROUP = "procedureInnerBlock";
const PROCEDURE_STEP_GROUP = "procedureStepBlock";
const PROCEDURE_TEXT_GROUP = "procedureTextBlock";
const PROCEDURE_ITEM_GROUP = "procedureItemBlock";

function tagRules(tag: string) {
  const lower = tag.toLowerCase();
  return [{ tag: lower }, { tag }];
}

/** 块节点：导入时读取 `id` 与 `sourceXmlAttrKeys`。 */
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

function createInlineTextNode(
  name: string,
  group: string = PROCEDURE_TEXT_GROUP,
) {
  return Node.create({
    name,
    group,
    content: "inline*",
    parseHTML: () => tagRules(name),
    renderHTML({ HTMLAttributes }) {
      return [name, mergeAttributes(HTMLAttributes), 0];
    },
  });
}

/** `noConds` / `noSupportEquips` 等：空占位，编辑区展示「无」，不落正文。 */
function createProcedureEmptyPlaceholderNode(name: string) {
  return Node.create({
    name,
    group: PROCEDURE_ITEM_GROUP,
    atom: true,
    selectable: false,
    parseHTML: () => blockTagParseRules(name),
    renderHTML({ HTMLAttributes }) {
      return [name, mergeAttributes(HTMLAttributes)];
    },
    addNodeView() {
      return ReactNodeViewRenderer(ProcedureEmptyPlaceholderNodeView);
    },
  });
}

/** 程序类 DM 三个顶层节。 */
export const S1000DPreliminaryRqmts = Node.create({
  name: "preliminaryRqmts",
  group: PROCEDURE_SECTION_GROUP,
  content:
    "reqCondGroup reqPersons reqSupportEquips reqSupplies reqSpares reqSafety",
  parseHTML: () => blockTagParseRules("preliminaryRqmts"),
  renderHTML({ HTMLAttributes }) {
    return ["preliminaryRqmts", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PreliminaryRqmtsNodeView);
  },
});

export const S1000DMainProcedure = Node.create({
  name: "mainProcedure",
  group: PROCEDURE_SECTION_GROUP,
  content: "proceduralStep+",
  parseHTML: () => blockTagParseRules("mainProcedure"),
  renderHTML({ HTMLAttributes }) {
    return ["mainProcedure", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MainProcedureNodeView);
  },
});

export const S1000DCloseRqmts = Node.create({
  name: "closeRqmts",
  group: PROCEDURE_SECTION_GROUP,
  content: "reqCondGroup",
  parseHTML: () => blockTagParseRules("closeRqmts"),
  renderHTML({ HTMLAttributes }) {
    return ["closeRqmts", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CloseRqmtsNodeView);
  },
});

export const S1000DProceduralStep = Node.create({
  name: "proceduralStep",
  group: PROCEDURE_STEP_GROUP,
  content:
    "(title?) (para | warning | caution | note | figure | table | bulletList | orderedList)* proceduralStep*",
  defining: true,
  isolating: true,
  parseHTML: () => blockTagParseRules("proceduralStep"),
  renderHTML({ HTMLAttributes }) {
    return ["proceduralStep", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ProceduralStepNodeView);
  },
});

export const S1000DReqCondGroup = Node.create({
  name: "reqCondGroup",
  group: PROCEDURE_INNER_GROUP,
  content: "noConds | reqCondNoRef+",
  parseHTML: () => blockTagParseRules("reqCondGroup"),
  renderHTML({ HTMLAttributes }) {
    return ["reqCondGroup", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqGroupNodeView);
  },
});

export const S1000DReqCondNoRef = Node.create({
  name: "reqCondNoRef",
  group: PROCEDURE_ITEM_GROUP,
  content: "reqCond",
  parseHTML: () => blockTagParseRules("reqCondNoRef"),
  renderHTML({ HTMLAttributes }) {
    return ["reqCondNoRef", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqCondNoRefNodeView);
  },
});

export const S1000DReqCond = createInlineTextNode("reqCond");

export const S1000DNoConds = createProcedureEmptyPlaceholderNode("noConds");

export const S1000DReqPersons = Node.create({
  name: "reqPersons",
  group: PROCEDURE_INNER_GROUP,
  content: "personnel*",
  parseHTML: () => blockTagParseRules("reqPersons"),
  renderHTML({ HTMLAttributes }) {
    return ["reqPersons", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqPersonsNodeView);
  },
});

export const S1000DPersonnel = Node.create({
  name: "personnel",
  group: PROCEDURE_ITEM_GROUP,
  content: "personCategory personSkill trade estimatedTime",
  addAttributes() {
    return { numRequired: attrSpec("numRequired") };
  },
  parseHTML: () => blockTagParseRules("personnel"),
  renderHTML({ HTMLAttributes }) {
    return ["personnel", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PersonnelNodeView);
  },
});

export const S1000DPersonCategory = Node.create({
  name: "personCategory",
  group: PROCEDURE_TEXT_GROUP,
  content: "inline*",
  addAttributes() {
    return { personCategoryCode: attrSpec("personCategoryCode") };
  },
  parseHTML: () => tagRules("personCategory"),
  renderHTML({ HTMLAttributes }) {
    return ["personCategory", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DPersonSkill = Node.create({
  name: "personSkill",
  group: PROCEDURE_TEXT_GROUP,
  content: "inline*",
  addAttributes() {
    return { skillLevelCode: attrSpec("skillLevelCode") };
  },
  parseHTML: () => tagRules("personSkill"),
  renderHTML({ HTMLAttributes }) {
    return ["personSkill", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DTrade = createInlineTextNode("trade");
export const S1000DEstimatedTime = Node.create({
  name: "estimatedTime",
  group: PROCEDURE_TEXT_GROUP,
  content: "inline*",
  addAttributes() {
    return { unitOfMeasure: attrSpec("unitOfMeasure") };
  },
  parseHTML: () => tagRules("estimatedTime"),
  renderHTML({ HTMLAttributes }) {
    return ["estimatedTime", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DReqSupportEquips = Node.create({
  name: "reqSupportEquips",
  group: PROCEDURE_INNER_GROUP,
  content: "noSupportEquips | supportEquipDescrGroup",
  parseHTML: () => blockTagParseRules("reqSupportEquips"),
  renderHTML({ HTMLAttributes }) {
    return ["reqSupportEquips", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqGroupNodeView);
  },
});

export const S1000DNoSupportEquips =
  createProcedureEmptyPlaceholderNode("noSupportEquips");
export const S1000DSupportEquipDescrGroup = Node.create({
  name: "supportEquipDescrGroup",
  group: PROCEDURE_ITEM_GROUP,
  content: "supportEquipDescr+",
  parseHTML: () => blockTagParseRules("supportEquipDescrGroup"),
  renderHTML({ HTMLAttributes }) {
    return ["supportEquipDescrGroup", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SupportEquipDescrGroupNodeView);
  },
});

export const S1000DSupportEquipDescr = Node.create({
  name: "supportEquipDescr",
  group: PROCEDURE_ITEM_GROUP,
  content: "name natoStockNumber identNumber? reqQuantity? remarks?",
  parseHTML: () => blockTagParseRules("supportEquipDescr"),
  renderHTML({ HTMLAttributes }) {
    return ["supportEquipDescr", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SupportEquipDescrNodeView);
  },
});

export const S1000DReqSupplies = Node.create({
  name: "reqSupplies",
  group: PROCEDURE_INNER_GROUP,
  content: "noSupplies | supplyDescrGroup",
  parseHTML: () => blockTagParseRules("reqSupplies"),
  renderHTML({ HTMLAttributes }) {
    return ["reqSupplies", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqGroupNodeView);
  },
});

export const S1000DNoSupplies = createProcedureEmptyPlaceholderNode("noSupplies");
export const S1000DSupplyDescrGroup = Node.create({
  name: "supplyDescrGroup",
  group: PROCEDURE_ITEM_GROUP,
  content: "supplyDescr+",
  parseHTML: () => blockTagParseRules("supplyDescrGroup"),
  renderHTML({ HTMLAttributes }) {
    return ["supplyDescrGroup", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SupplyDescrGroupNodeView);
  },
});

export const S1000DSupplyDescr = Node.create({
  name: "supplyDescr",
  group: PROCEDURE_ITEM_GROUP,
  content: "name natoStockNumber identNumber? reqQuantity? remarks?",
  parseHTML: () => blockTagParseRules("supplyDescr"),
  renderHTML({ HTMLAttributes }) {
    return ["supplyDescr", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SupplyDescrNodeView);
  },
});

export const S1000DReqSpares = Node.create({
  name: "reqSpares",
  group: PROCEDURE_INNER_GROUP,
  content: "noSpares | spareDescrGroup",
  parseHTML: () => blockTagParseRules("reqSpares"),
  renderHTML({ HTMLAttributes }) {
    return ["reqSpares", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqGroupNodeView);
  },
});

export const S1000DNoSpares = createProcedureEmptyPlaceholderNode("noSpares");
export const S1000DSpareDescrGroup = Node.create({
  name: "spareDescrGroup",
  group: PROCEDURE_ITEM_GROUP,
  content: "spareDescr+",
  parseHTML: () => blockTagParseRules("spareDescrGroup"),
  renderHTML({ HTMLAttributes }) {
    return ["spareDescrGroup", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SpareDescrGroupNodeView);
  },
});

export const S1000DSpareDescr = Node.create({
  name: "spareDescr",
  group: PROCEDURE_ITEM_GROUP,
  content: "name natoStockNumber identNumber? reqQuantity? remarks?",
  parseHTML: () => blockTagParseRules("spareDescr"),
  renderHTML({ HTMLAttributes }) {
    return ["spareDescr", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SpareDescrNodeView);
  },
});

export const S1000DReqSafety = Node.create({
  name: "reqSafety",
  group: PROCEDURE_INNER_GROUP,
  content: "noSafety | safetyRqmts",
  parseHTML: () => blockTagParseRules("reqSafety"),
  renderHTML({ HTMLAttributes }) {
    return ["reqSafety", mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReqGroupNodeView);
  },
});

export const S1000DNoSafety = createProcedureEmptyPlaceholderNode("noSafety");
export const S1000DSafetyRqmts = Node.create({
  name: "safetyRqmts",
  group: PROCEDURE_ITEM_GROUP,
  content: "(warning | caution | note)+",
  parseHTML: () => blockTagParseRules("safetyRqmts"),
  renderHTML({ HTMLAttributes }) {
    return ["safetyRqmts", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DIdentNumber = Node.create({
  name: "identNumber",
  group: PROCEDURE_TEXT_GROUP,
  content: "partAndSerialNumber",
  parseHTML: () => tagRules("identNumber"),
  renderHTML({ HTMLAttributes }) {
    return ["identNumber", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DPartAndSerialNumber = Node.create({
  name: "partAndSerialNumber",
  group: PROCEDURE_TEXT_GROUP,
  content: "partNumber",
  parseHTML: () => tagRules("partAndSerialNumber"),
  renderHTML({ HTMLAttributes }) {
    return ["partAndSerialNumber", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DPartNumber = createInlineTextNode("partNumber");
export const S1000DName = createInlineTextNode("name");
export const S1000DNatoStockNumber = createInlineTextNode("natoStockNumber");
export const S1000DReqQuantity = Node.create({
  name: "reqQuantity",
  group: PROCEDURE_TEXT_GROUP,
  content: "inline*",
  addAttributes() {
    return { unitOfMeasure: attrSpec("unitOfMeasure") };
  },
  parseHTML: () => tagRules("reqQuantity"),
  renderHTML({ HTMLAttributes }) {
    return ["reqQuantity", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DRemarks = Node.create({
  name: "remarks",
  group: PROCEDURE_TEXT_GROUP,
  content: "inline*",
  parseHTML: () => tagRules("remarks"),
  renderHTML({ HTMLAttributes }) {
    return ["remarks", mergeAttributes(HTMLAttributes), 0];
  },
});

/** 程序类 `inline*` 文本块：与 `para` 一样支持编辑器内 textAlign（不落 S1000D XML）。 */
export const PROCEDURE_TEXT_ALIGN_NODE_TYPES = [
  "reqCond",
  "personCategory",
  "personSkill",
  "trade",
  "estimatedTime",
  "partNumber",
  "name",
  "natoStockNumber",
  "reqQuantity",
  "remarks",
] as const;

/** 程序类节点（子类型先于容器注册）。 */
export const s1000dProcedureNodes = [
  S1000DReqCond,
  S1000DNoConds,
  S1000DReqCondNoRef,
  S1000DPersonCategory,
  S1000DPersonSkill,
  S1000DTrade,
  S1000DEstimatedTime,
  S1000DPersonnel,
  S1000DPartNumber,
  S1000DPartAndSerialNumber,
  S1000DIdentNumber,
  S1000DName,
  S1000DNatoStockNumber,
  S1000DReqQuantity,
  S1000DRemarks,
  S1000DSupportEquipDescr,
  S1000DSupportEquipDescrGroup,
  S1000DNoSupportEquips,
  S1000DSupplyDescr,
  S1000DSupplyDescrGroup,
  S1000DNoSupplies,
  S1000DSpareDescr,
  S1000DSpareDescrGroup,
  S1000DNoSpares,
  S1000DSafetyRqmts,
  S1000DNoSafety,
  S1000DReqCondGroup,
  S1000DReqPersons,
  S1000DReqSupportEquips,
  S1000DReqSupplies,
  S1000DReqSpares,
  S1000DReqSafety,
  S1000DProceduralStep,
  S1000DPreliminaryRqmts,
  S1000DMainProcedure,
  S1000DCloseRqmts,
] as const;
