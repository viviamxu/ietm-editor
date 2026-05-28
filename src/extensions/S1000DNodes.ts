import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { DmRefNodeView } from "./s1000d/DmRefNodeView";
import { InternalRefNodeView } from "./s1000d/InternalRefNodeView";
import { S1000DEmphasis } from "./s1000dEmphasis";
import { GraphicNodeView } from "./s1000d/GraphicNodeView";
import { FigureNodeView } from "./s1000d/FigureNodeView";
import { MultimediaNodeView } from "./s1000d/MultimediaNodeView";
import { MultimediaObjectNodeView } from "./s1000d/MultimediaObjectNodeView";
import { LevelledParaNodeView } from "./s1000d/LevelledParaNodeView";
import { s1000dTableNodes } from "./s1000d/s1000dTableNodes";
import { S1000DSub, S1000DSup } from "./s1000d/subSuperMarks";
import {
  NoteLeadNodeView,
  NoteNodeView,
  NoteParaNodeView,
} from "./s1000d/NoteNodeView";
import {
  WarningAndCautionLeadNodeView,
  WarningAndCautionParaNodeView,
  WarningNodeView,
} from "./s1000d/WarningNodeView";
import type { FigureAttrs, ParaAttrs } from "./s1000d/types";
import {
  readParaAttrsFromDom,
  s1000dParaAttributeSpec,
} from "../lib/s1000d/paraAttributes";
import { s1000dIdAttributeConfig } from "../lib/s1000d/s1000dIdAttribute";
import {
  FIGURE_XML_ATTR_NAMES,
  SOURCE_XML_ATTR_KEYS,
  hasXmlAttr,
  xmlAttrsPresentOnElement,
} from "../lib/s1000d/sourceXmlAttrKeys";
import {
  readGraphicSrcFromElement,
  readXlinkHrefFromElement,
} from "../lib/s1000d/xlinkHref";
import { useDmMetadataStore } from "../store/dmMetadataStore";

export type { FigureAttrs, ParaAttrs, S1000DEditorJSON } from "./s1000d/types";
export { S1000DEmphasis };

/**
 * 判断给定元素是否为我们关心的 S1000D `title` 容器。
 * `text/html` 解析后标签名为小写（如 `levelledpara`）；`levelledPara` 的 NodeView 下标题父级可能是
 * `div.s1000d-levelled-para__content` 或带 `data-s1000d-node="levelledPara"` 的外壳。
 */
function isS1000DTitleParent(parent: Element | null): boolean {
  if (!parent) return false;
  if (parent.getAttribute("data-s1000d-node") === "levelledPara") return true;
  if (parent.classList.contains("s1000d-levelled-para__content")) return true;
  if (parent.getAttribute("data-s1000d-xml-table") === "1") return true;

  if (
    parent.getAttribute("data-s1000d-node") === "isolationStep" ||
    parent.getAttribute("data-s1000d-node") === "isolationProcedureEnd"
  ) {
    return true;
  }
  if (
    parent.classList.contains("s1000d-isolation-step__content") ||
    parent.classList.contains("s1000d-isolation-end__content")
  ) {
    return true;
  }

  const ln = parent.localName.toLowerCase();
  return (
    ln === "levelledpara" ||
    ln === "figure" ||
    ln === "table" ||
    ln === "sequentiallist" ||
    ln === "randomlist" ||
    ln === "multimedia" ||
    ln === "isolationstep" ||
    ln === "isolationprocedureend"
  );
}

const S1000D_TITLE_LEVEL_CAP = 6;

/** 图题/表题等：不参与 levelledPara 章节标题层级（对应 `data-s1000d-title-level="0"`） */
const S1000D_TITLE_CAPTION_LEVEL = 0;

const TITLE_CAPTION_PARENT_TYPES = new Set(["figure", "table", "multimedia"]);

const s1000dTitleLevelsKey = new PluginKey<{ forceInitialSync?: true }>(
  "s1000d-title-levels",
);

function clampS1000dTitleDisplayLevel(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  const rounded = Math.round(raw);
  if (rounded === S1000D_TITLE_CAPTION_LEVEL) return S1000D_TITLE_CAPTION_LEVEL;
  return Math.min(S1000D_TITLE_LEVEL_CAP, Math.max(1, rounded));
}

function normalizeTitleDisplayLevel(raw: number | null | undefined): number {
  if (raw === S1000D_TITLE_CAPTION_LEVEL) return S1000D_TITLE_CAPTION_LEVEL;
  return clampS1000dTitleDisplayLevel(Number(raw ?? 1));
}

/**
 * `levelledPara` 下 title：按祖先 `levelledPara` 深度 1~6。
 * `figure` / `table` / `multimedia` 下 title：固定为 0（图题/表题，不用 levelledPara 深度）。
 */
function computeTitleDisplayLevel(doc: PMNode, titleStartPos: number): number {
  try {
    const $pos = doc.resolve(titleStartPos + 1);
    let titleDepth = -1;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === "title") {
        titleDepth = d;
        break;
      }
    }
    if (titleDepth > 0) {
      const parentType = $pos.node(titleDepth - 1).type.name;
      if (TITLE_CAPTION_PARENT_TYPES.has(parentType)) {
        return S1000D_TITLE_CAPTION_LEVEL;
      }
    }
    let count = 0;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === "levelledPara") count++;
    }
    return clampS1000dTitleDisplayLevel(Math.max(1, count));
  } catch {
    return 1;
  }
}

function createS1000dTitleLevelsPlugin() {
  return new Plugin({
    key: s1000dTitleLevelsKey,
    appendTransaction(transactions, _oldState, newState) {
      const docChanged = transactions.some((tr) => tr.docChanged);
      const forced = transactions.some((tr) => {
        const meta = tr.getMeta(s1000dTitleLevelsKey);
        return meta?.forceInitialSync === true;
      });
      // 初始文档不经 dispatch，仅靠 Plugin.view + meta 走首次展平（见上方 view(...)）
      if (!docChanged && !forced) return null;

      let tr = newState.tr;
      let changed = false;

      newState.doc.descendants((node, pos) => {
        if (node.type.name !== "title") return true;

        const next = computeTitleDisplayLevel(newState.doc, pos);
        const curr = normalizeTitleDisplayLevel(
          (node.attrs as { displayLevel?: number }).displayLevel,
        );

        if (curr !== next) {
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            displayLevel: next,
          });
          changed = true;
        }
        return true;
      });

      return changed ? tr : null;
    },
    view(editorView: EditorView) {
      queueMicrotask(() => {
        if (editorView.isDestroyed) return;
        editorView.dispatch(
          editorView.state.tr.setMeta(s1000dTitleLevelsKey, {
            forceInitialSync: true,
          }),
        );
      });
      return {};
    },
  });
}

function parseS1000dTitleDisplayLevelFromElement(el: Element): number {
  const fromData = el.getAttribute("data-s1000d-title-level");
  if (fromData != null && fromData.trim() !== "") {
    const n = Number.parseInt(fromData, 10);
    if (!Number.isNaN(n)) return clampS1000dTitleDisplayLevel(n);
  }
  const m = /^h([1-6])$/i.exec(el.tagName ?? "");
  if (m) return clampS1000dTitleDisplayLevel(Number.parseInt(m[1], 10));
  return 1;
}

/**
 * 嵌套块专用组：不得使用 `block`，否则在 `paragraph` 关闭后会被 `doc` 的 `block+`
 * 当成默认块（回车易出现 `attentionListItemPara` 等）。
 */
const WARNING_CAUTION_LEAD_GROUP = "warningAndCautionLeadBlock";
const ATTENTION_LIST_ITEM_PARA_GROUP = "attentionListItemBlock";
const ATTENTION_RANDOM_LIST_ITEM_GROUP = "attentionRandomListItemBlock";
const ATTENTION_RANDOM_LIST_GROUP = "attentionRandomListBlock";
const WARNING_CAUTION_PARA_GROUP = "warningAndCautionParaBlock";
const NOTE_LEAD_GROUP = "noteLeadBlock";
const NOTE_PARA_GROUP = "noteParaBlock";
const S1000D_TITLE_GROUP = "s1000dTitleBlock";

/** 编辑器内部块：承接 `warningAndCautionPara` 内、位于 `attentionRandomList` 之前的行内与前导内容（原装 XML 无此外壳，导入时写入）。 */
export const WarningAndCautionLead = Node.create({
  name: "warningAndCautionLead",
  group: WARNING_CAUTION_LEAD_GROUP,

  content: "inline*",

  parseHTML() {
    return [
      {
        tag: "warningAndCautionLead",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "warningandcautionlead",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["warningAndCautionLead", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WarningAndCautionLeadNodeView);
  },
});

/** S1000D `attentionListItemPara`，位于 `attentionRandomListItem` 内。 */
export const AttentionListItemPara = Node.create({
  name: "attentionListItemPara",
  group: ATTENTION_LIST_ITEM_PARA_GROUP,

  content: "inline*",

  parseHTML() {
    return [
      {
        tag: "attentionListItemPara",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "attentionlistitempara",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["attentionListItemPara", mergeAttributes(HTMLAttributes), 0];
  },
});

/** S1000D `attentionRandomListItem`。 */
export const AttentionRandomListItem = Node.create({
  name: "attentionRandomListItem",
  group: ATTENTION_RANDOM_LIST_ITEM_GROUP,

  content: "attentionListItemPara+",

  parseHTML() {
    return [
      {
        tag: "attentionRandomListItem",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "attentionrandomlistitem",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["attentionRandomListItem", mergeAttributes(HTMLAttributes), 0];
  },
});

/** S1000D `attentionRandomList`（attention 无序列表容器）。 */
export const AttentionRandomList = Node.create({
  name: "attentionRandomList",
  group: ATTENTION_RANDOM_LIST_GROUP,

  content: "attentionRandomListItem+",

  defining: true,

  parseHTML() {
    return [
      {
        tag: "attentionRandomList",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "attentionrandomlist",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["attentionRandomList", mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * `warningAndCautionPara`：与样例 XML 一致，先有可选前导正文（`warningAndCautionLead`），后有可选 `attentionRandomList`。
 * 原装 XML 中前导文字为裸文本，由 `normalizeS1000dDescriptionInnerXmlForEditor` 包入 `warningAndCautionLead` 后再喂给 Tiptap。
 */
export const WarningAndCautionPara = Node.create({
  name: "warningAndCautionPara",
  group: WARNING_CAUTION_PARA_GROUP,

  content: "warningAndCautionLead? attentionRandomList?",

  parseHTML() {
    return [
      {
        tag: "warningAndCautionPara",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["warningAndCautionPara", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WarningAndCautionParaNodeView);
  },
});

/**
 * S1000D `warning`：块级注意单元，子节点必须为至少一个 `warningAndCautionPara`。
 * 视图层使用 `ReactNodeViewRenderer` 提供可辨识的 WYSIWYG 外壳。
 */
export const S1000DWarning = Node.create({
  name: "warning",
  group: "block attentionElemGroup warningAndCautionElemGroup",
  content: "warningAndCautionPara+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("id") : null,
        renderHTML: (attrs) =>
          (attrs as { id?: string | null }).id
            ? { id: (attrs as { id: string }).id }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "warning",
        getAttrs: (el) =>
          el instanceof Element
            ? {
                id: el.getAttribute("id"),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ["id"]),
              }
            : {},
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["warning", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WarningNodeView);
  },
});

/**
 * S1000D `caution`：与 `warning` 同形（`warningAndCautionPara+`）；样例 DM 中使用。
 */
export const S1000DCaution = Node.create({
  name: "caution",
  group: "block attentionElemGroup warningAndCautionElemGroup",
  content: "warningAndCautionPara+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("id") : null,
        renderHTML: (attrs) =>
          (attrs as { id?: string | null }).id
            ? { id: (attrs as { id: string }).id }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "caution",
        getAttrs: (el) =>
          el instanceof Element
            ? {
                id: el.getAttribute("id"),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ["id"]),
              }
            : {},
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["caution", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WarningNodeView);
  },
});

/** 编辑器内部块：`notePara` 内、位于 `attentionRandomList` 之前的前导正文（导出时剥壳）。 */
export const NoteLead = Node.create({
  name: "noteLead",
  group: NOTE_LEAD_GROUP,

  content: "inline*",

  parseHTML() {
    return [
      {
        tag: "noteLead",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "notelead",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["noteLead", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLeadNodeView);
  },
});

/**
 * S1000D `notePara`：前导 `noteLead` 与可选 `attentionRandomList`（与样例 XML 并排结构一致）。
 */
export const NotePara = Node.create({
  name: "notePara",
  group: NOTE_PARA_GROUP,
  content: "noteLead? attentionRandomList?",

  parseHTML() {
    return [
      {
        tag: "notePara",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
      {
        tag: "notepara",
        getAttrs: () => ({ [SOURCE_XML_ATTR_KEYS]: [] as string[] }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["notePara", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteParaNodeView);
  },
});

/**
 * S1000D `note`：与描述类 Schema 一致，`group` 含 `attentionElemGroup`。
 */
export const S1000DNote = Node.create({
  name: "note",
  group: "block attentionElemGroup",
  content: "notePara+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("id") : null,
        renderHTML: (attrs) =>
          (attrs as { id?: string | null }).id
            ? { id: (attrs as { id: string }).id }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "note",
        getAttrs: (el) =>
          el instanceof Element
            ? {
                id: el.getAttribute("id"),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ["id"]),
              }
            : {},
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["note", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteNodeView);
  },
});

/** `displayLevel` 仅当源 HTML 上存在 `data-s1000d-title-level` 时视为「源上出现」并记入 `sourceXmlAttrKeys`。 */
function titleSourceXmlAttrKeysFromEl(el: Element): string[] {
  return hasXmlAttr(el, "data-s1000d-title-level") ? ["displayLevel"] : [];
}

/** h1～h6 + `data-s1000d-title`，层级数字由标签 / `data-s1000d-title-level` 经 `displayLevel.parseHTML` 读取。 */
const s1000dTitleHeadingParseRules = ([1, 2, 3, 4, 5, 6] as const).map(
  (level) => ({
    tag: `h${level}[data-s1000d-title]`,
    priority: 100,
    getAttrs: (el: HTMLElement) => {
      if (!el || !(el instanceof Element)) return false;
      return isS1000DTitleParent(el.parentElement)
        ? {
            displayLevel: parseS1000dTitleDisplayLevelFromElement(el),
            [SOURCE_XML_ATTR_KEYS]: titleSourceXmlAttrKeysFromEl(el),
          }
        : false;
    },
  }),
);

/**
 * S1000D `title`：标题行块，Schema 为 `(text)*`；此处建模为 `inline*` 以支持后续行内标记扩展。
 * 展示级数：`levelledPara` 下按祖先深度 1~6；`figure` 等块内图题为 0（非章节标题）。
 */
export const S1000DTitle = Node.create({
  name: "title",
  group: S1000D_TITLE_GROUP,
  content: "inline*",

  addAttributes() {
    return {
      /** 仅用于编辑/HTML 往返，不落 S1000D XML `<title>` 属性 */
      displayLevel: {
        default: 1,
        parseHTML: (el) =>
          el instanceof Element
            ? parseS1000dTitleDisplayLevelFromElement(el)
            : 1,
        renderHTML: (attrs) => ({
          "data-s1000d-title-level": String(
            normalizeTitleDisplayLevel(
              (attrs as { displayLevel?: number }).displayLevel,
            ),
          ),
        }),
      },
    };
  },

  addProseMirrorPlugins() {
    return [createS1000dTitleLevelsPlugin()];
  },

  parseHTML() {
    return [
      {
        tag: "s1000d-block-title",
        priority: 105,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return isS1000DTitleParent(el.parentElement)
            ? {
                displayLevel: parseS1000dTitleDisplayLevelFromElement(el),
                [SOURCE_XML_ATTR_KEYS]: titleSourceXmlAttrKeysFromEl(el),
              }
            : false;
        },
      },
      ...s1000dTitleHeadingParseRules,
      {
        tag: "title",
        priority: 51,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return isS1000DTitleParent(el.parentElement)
            ? {
                displayLevel: parseS1000dTitleDisplayLevelFromElement(el),
                [SOURCE_XML_ATTR_KEYS]: titleSourceXmlAttrKeysFromEl(el),
              }
            : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = normalizeTitleDisplayLevel(
      (node.attrs as { displayLevel?: number }).displayLevel,
    );
    return [
      "s1000d-block-title",
      mergeAttributes(HTMLAttributes, {
        "data-s1000d-title": "1",
        "data-s1000d-title-level": String(level),
        class: "s1000d-title-display",
      }),
      0,
    ];
  },
});

function copyElementAttributes(src: Element, dest: Element) {
  for (const { name, value } of Array.from(src.attributes)) {
    dest.setAttribute(name, value);
  }
}

/**
 * S1000D `para`：描述类正文的主要段落块；允许多种行内（Phase 1 仅 `inline*`，与 Schema 中 text 组对齐的第一步）。
 * 透传样例 XML 中出现的安全/衍生分类等属性，便于往返 XML。
 */
export const S1000DPara = Node.create({
  name: "para",
  priority: 1000,
  group: "block",
  content: "inline*",

  addAttributes(): Record<keyof ParaAttrs, { default: string | null }> {
    return s1000dParaAttributeSpec();
  },

  parseHTML() {
    return [
      {
        tag: "para",
        priority: 200,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return readParaAttrsFromDom(el);
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["para", mergeAttributes(HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name !== "para") continue;
          return editor.chain().focus().splitBlock().run();
        }
        return false;
      },
    };
  },
});

/**
 * 从浏览器 DOM 读取 internalRef 的属性（序列化后经 HTML 可能为小写）。
 */
function readInternalRefAttrsFromDom(el: Element) {
  return {
    internalRefId:
      el.getAttribute("internalRefId") ?? el.getAttribute("internalrefid"),
    internalRefTargetType:
      el.getAttribute("internalRefTargetType") ??
      el.getAttribute("internalreftargettype"),
  };
}

function readInternalRefSourceXmlAttrKeys(el: Element): string[] {
  const keys: string[] = [];
  if (
    hasXmlAttr(el, "internalRefId") ||
    hasXmlAttr(el, "internalrefid") ||
    hasXmlAttr(el, "data-internal-ref-id")
  ) {
    keys.push("internalRefId");
  }
  if (
    hasXmlAttr(el, "internalRefTargetType") ||
    hasXmlAttr(el, "internalreftargettype") ||
    hasXmlAttr(el, "data-internal-ref-target-type")
  ) {
    keys.push("internalRefTargetType");
  }
  return keys;
}

/** `dmRef` 行内占位：段落内整块 DM 引用若按块解析会破坏 `para` — 先吞成原子占位，后续可换完整 Node。 */
export const S1000DDmRef = Node.create({
  name: "dmRef",
  group: "inline textElemGroup",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      rawXml: { default: "" },
      displayCode: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-display-code"),
        renderHTML: (attrs: { displayCode?: string | null }) => {
          const v = attrs.displayCode;
          if (v == null || String(v).trim() === "") return {};
          return { "data-display-code": String(v).trim() };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-s1000d-dm-ref="1"]',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const encoded = el.getAttribute("data-raw-xml");
          const rawXml = encoded
            ? decodeURIComponent(encoded)
            : String(el.getAttribute("data-dm-ref-raw") ?? "");
          if (!rawXml.trim()) return false;
          return {
            rawXml,
            displayCode: el.getAttribute("data-display-code"),
            [SOURCE_XML_ATTR_KEYS]: ["rawXml"],
          };
        },
      },
      {
        tag: "dmref, dmRef", // HTML 会传小写，都拦截住
        getAttrs: (el) => {
          const nodeEl = el as Element;
          const encoded = nodeEl.getAttribute("data-raw-xml");
          const rawXml = encoded
            ? decodeURIComponent(encoded)
            : nodeEl.outerHTML;
          return {
            rawXml,
            displayCode: nodeEl.getAttribute("data-display-code"),
            [SOURCE_XML_ATTR_KEYS]: ["rawXml"],
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const rawXml = String(node.attrs.rawXml ?? "").trim();
    const extra: Record<string, string> = {
      class: "s1000d-dmref-chip",
      "data-s1000d-dm-ref": "1",
    };
    if (rawXml) {
      extra["data-raw-xml"] = encodeURIComponent(rawXml);
    }
    const displayCode = String(node.attrs.displayCode ?? "").trim();
    if (displayCode) {
      extra["data-display-code"] = displayCode;
    }
    return ["span", mergeAttributes(HTMLAttributes, extra)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DmRefNodeView);
  },
});
/**
 * S1000D `internalRef`：内部引用；兼容 `internalRef`/`internalref`/`span[data-s1000d-internal-ref]`。
 */
export const S1000DInternalRef = Node.create({
  name: "internalRef",
  group: "inline textElemGroup attentionTextGroup",
  inline: true,
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      internalRefId: { default: null },
      internalRefTargetType: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-s1000d-internal-ref="1"]',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const fromChip = readInternalRefAttrsFromDom(el);
          return {
            internalRefId:
              el.getAttribute("data-internal-ref-id") ?? fromChip.internalRefId,
            internalRefTargetType:
              el.getAttribute("data-internal-ref-target-type") ??
              fromChip.internalRefTargetType,
            [SOURCE_XML_ATTR_KEYS]: readInternalRefSourceXmlAttrKeys(el),
          };
        },
      },
      {
        tag: "internalRef",
        getAttrs: (el) => ({
          ...readInternalRefAttrsFromDom(el as Element),
          [SOURCE_XML_ATTR_KEYS]: readInternalRefSourceXmlAttrKeys(
            el as Element,
          ),
        }),
      },
      {
        tag: "internalref",
        getAttrs: (el) => ({
          ...readInternalRefAttrsFromDom(el as Element),
          [SOURCE_XML_ATTR_KEYS]: readInternalRefSourceXmlAttrKeys(
            el as Element,
          ),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as {
      internalRefId?: string | null;
      internalRefTargetType?: string | null;
    };
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-s1000d-internal-ref": "1",
        "data-internal-ref-id": attrs.internalRefId ?? "",
        "data-internal-ref-target-type": attrs.internalRefTargetType ?? "",
        class: "s1000d-internal-ref",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InternalRefNodeView);
  },
});

function readGraphicSourceXmlAttrKeys(el: Element): string[] {
  const keys: string[] = [];
  if (hasXmlAttr(el, "id")) keys.push("id");
  if (hasXmlAttr(el, "infoEntityIdent") || hasXmlAttr(el, "infoentityident")) {
    keys.push("infoEntityIdent");
  }
  if (readGraphicSrcFromElement(el)) keys.push("src");
  return keys;
}

/**
 * S1000D `graphic`：`figure` 下的媒体引用占位（无文本子节点）。
 * 源 XML `xlink:href` 读入 `src`；编辑器内以标准 `<img>` 展示。
 */
export const S1000DGraphic = Node.create({
  name: "graphic",
  atom: true,
  group: "block",
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("id") : null,
        renderHTML: (attrs) =>
          (attrs as { id?: string | null }).id
            ? { id: (attrs as { id: string }).id }
            : {},
      },
      infoEntityIdent: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element
            ? (el.getAttribute("infoEntityIdent") ??
              el.getAttribute("infoentityident") ??
              el.getAttribute("data-info-entity-ident"))
            : null,
        renderHTML: (attrs) => {
          const v = (attrs as { infoEntityIdent?: string | null })
            .infoEntityIdent;
          return v ? { "data-info-entity-ident": String(v) } : {};
        },
      },
      /** 预览地址：S1000D `xlink:href` 或编辑器 `img@src` / `data-editor-src`。 */
      src: {
        default: "",
        parseHTML: (el) =>
          el instanceof Element ? readGraphicSrcFromElement(el) : "",
        renderHTML: (attrs) => {
          const s = (attrs as { src?: string | null }).src;
          const t = typeof s === "string" ? s.trim() : "";
          return { src: t || "" };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "graphic",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const src = readGraphicSrcFromElement(el);
          return {
            id: el.getAttribute("id"),
            infoEntityIdent:
              el.getAttribute("infoEntityIdent") ??
              el.getAttribute("infoentityident"),
            src,
            [SOURCE_XML_ATTR_KEYS]: readGraphicSourceXmlAttrKeys(el),
          };
        },
      },
      {
        tag: "img",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          if (el.getAttribute("data-s1000d-node") !== "graphic") return false;
          const src = readGraphicSrcFromElement(el);
          return {
            id: el.getAttribute("data-graphic-id") ?? el.getAttribute("id"),
            infoEntityIdent: el.getAttribute("data-info-entity-ident"),
            src,
            [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, [
              "id",
              "data-graphic-id",
              "data-info-entity-ident",
              "src",
              "xlink:href",
              "data-editor-src",
            ]),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const raw = node.attrs.src;
    const src =
      typeof raw === "string"
        ? raw.trim()
        : raw == null
          ? ""
          : String(raw).trim();
    const ident = node.attrs.infoEntityIdent
      ? String(node.attrs.infoEntityIdent)
      : "";
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: "s1000d-graphic-img",
        "data-s1000d-node": "graphic",
        draggable: "false",
        src: src || "",
        alt: ident || "",
        ...(ident ? { "data-info-entity-ident": ident } : {}),
        ...(node.attrs.id ? { "data-graphic-id": String(node.attrs.id) } : {}),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GraphicNodeView);
  },
});

/** 自源 XML `multimediaObject` 解析编辑器媒体 URL（`xlink:href` → mediaSrc / sceneSrc）。 */
function readMultimediaObjectAttrsFromElement(el: Element) {
  const xlinkHref = readXlinkHrefFromElement(el);
  const multimediaType =
    el.getAttribute("multimediaType") ??
    el.getAttribute("multimediatype") ??
    "other";
  const dataType = el.getAttribute("data-icn-type");
  const is3d = multimediaType === "3D" || dataType === "cc3d";
  const legacyMedia = el.getAttribute("data-media-src");
  const legacyScene = el.getAttribute("data-scene-src");
  return {
    infoEntityIdent:
      el.getAttribute("infoEntityIdent") ??
      el.getAttribute("infoentityident"),
    multimediaType,
    dataType,
    sceneSrc: legacyScene ?? (is3d && xlinkHref ? xlinkHref : null),
    previewImgSrc: el.getAttribute("data-preview-img-src"),
    fileType: el.getAttribute("data-file-type"),
    mediaSrc:
      legacyMedia ?? (!is3d && xlinkHref ? xlinkHref : null),
    sourceXmlAttrKeys: xmlAttrsPresentOnElement(el, [
      "infoEntityIdent",
      "infoentityident",
      "multimediaType",
      "multimediatype",
      "xlink:href",
    ]),
  };
}

/**
 * S1000D `multimediaObject`：`multimedia` 下的媒体实体引用（无文本子节点）。
 */
export const S1000DMultimediaObject = Node.create({
  name: "multimediaObject",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      infoEntityIdent: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element
            ? (el.getAttribute("infoEntityIdent") ??
              el.getAttribute("infoentityident") ??
              el.getAttribute("data-info-entity-ident"))
            : null,
        renderHTML: (attrs) => {
          const v = (attrs as { infoEntityIdent?: string | null })
            .infoEntityIdent;
          return v ? { infoEntityIdent: String(v) } : {};
        },
      },
      /** S1000D 必填：`video` | `audio` | `3D` | `computerGraphic` | `other` 等。 */
      multimediaType: {
        default: "other",
        parseHTML: (el) =>
          el instanceof Element
            ? (el.getAttribute("multimediaType") ??
              el.getAttribute("multimediatype"))
            : null,
        renderHTML: (attrs) => {
          const v = (attrs as { multimediaType?: string | null }).multimediaType;
          return v ? { multimediaType: String(v) } : {};
        },
      },
      /** ICN 业务类型："cc3d" 三维 | "math" 公式 | null 其它。仅存编辑器内存，不写入 S1000D XML。 */
      dataType: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("data-icn-type") : null,
        renderHTML: (attrs) => {
          const v = (attrs as { dataType?: string | null }).dataType;
          return v ? { "data-icn-type": v } : {};
        },
      },
      /** cc3d 场景 zip URL（cc-3d-scene src）。仅存编辑器内存，不写入 S1000D XML。 */
      sceneSrc: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("data-scene-src") : null,
        renderHTML: (attrs) => {
          const v = (attrs as { sceneSrc?: string | null }).sceneSrc;
          return v ? { "data-scene-src": v } : {};
        },
      },
      /** 2D 预览图 URL（视频封面 / cc-3d-scene img-src）。仅存编辑器内存，不写入 S1000D XML。 */
      previewImgSrc: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("data-preview-img-src") : null,
        renderHTML: (attrs) => {
          const v = (attrs as { previewImgSrc?: string | null }).previewImgSrc;
          return v ? { "data-preview-img-src": v } : {};
        },
      },
      /** 文件后缀（如 mp4）。仅存编辑器内存，不写入 S1000D XML。 */
      fileType: {
        default: null,
        parseHTML: (el) =>
          el instanceof Element ? el.getAttribute("data-file-type") : null,
        renderHTML: (attrs) => {
          const v = (attrs as { fileType?: string | null }).fileType;
          return v ? { "data-file-type": v } : {};
        },
      },
      /** 主媒体 URL；保存为 S1000D `xlink:href`，加载时读回。 */
      mediaSrc: {
        default: null,
        parseHTML: (el) => {
          if (!(el instanceof Element)) return null;
          const legacy = el.getAttribute("data-media-src");
          if (legacy?.trim()) return legacy.trim();
          const mt =
            el.getAttribute("multimediaType") ??
            el.getAttribute("multimediatype") ??
            "";
          const dataType = el.getAttribute("data-icn-type");
          if (mt === "3D" || dataType === "cc3d") return null;
          const fromXlink = readXlinkHrefFromElement(el);
          return fromXlink || null;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "multimediaObject",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const { sourceXmlAttrKeys, ...attrs } =
            readMultimediaObjectAttrsFromElement(el);
          return {
            ...attrs,
            [SOURCE_XML_ATTR_KEYS]: sourceXmlAttrKeys,
          };
        },
      },
      {
        tag: "multimediaobject",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const { sourceXmlAttrKeys, ...attrs } =
            readMultimediaObjectAttrsFromElement(el);
          return {
            ...attrs,
            [SOURCE_XML_ATTR_KEYS]: sourceXmlAttrKeys,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const ident = node.attrs.infoEntityIdent
      ? String(node.attrs.infoEntityIdent)
      : "";
    const multimediaType = node.attrs.multimediaType
      ? String(node.attrs.multimediaType)
      : "other";
    return [
      "multimediaObject",
      mergeAttributes(HTMLAttributes, {
        ...(ident ? { infoEntityIdent: ident } : {}),
        multimediaType,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MultimediaObjectNodeView);
  },
});

/**
 * S1000D `multimedia`：块级，`title?` + 至少一个 `multimediaObject`。
 */
export const S1000DMultimedia = Node.create({
  name: "multimedia",
  group: "block fmftElemGroup",
  content: "(title?) multimediaObject+",
  defining: true,

  parseHTML() {
    return [
      {
        tag: "multimedia",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return {
            [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, []),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["multimedia", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MultimediaNodeView);
  },
});

/**
 * S1000D `figure`：块级，`title?` + 至少一个 `graphic`。
 */
export const S1000DFigure = Node.create({
  name: "figure",
  group: "block fmftElemGroup",
  content: "(title?) graphic+",
  defining: true,

  addAttributes(): Record<keyof FigureAttrs, { default: string | null }> {
    return {
      id: s1000dIdAttributeConfig(),
      changeType: { default: null },
      changeMark: { default: null },
      reasonForUpdateRefIds: { default: null },
      authorityName: { default: null },
      authorityDocument: { default: null },
      securityClassification: { default: null },
      commercialClassification: { default: null },
      caveat: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return {
            id:
              el.getAttribute("id") ??
              el.getAttribute("data-s1000d-element-id"),
            changeType: el.getAttribute("changeType"),
            changeMark: el.getAttribute("changeMark"),
            reasonForUpdateRefIds: el.getAttribute("reasonForUpdateRefIds"),
            authorityName: el.getAttribute("authorityName"),
            authorityDocument: el.getAttribute("authorityDocument"),
            securityClassification: el.getAttribute("securityClassification"),
            commercialClassification: el.getAttribute(
              "commercialClassification",
            ),
            caveat: el.getAttribute("caveat"),
            [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(
              el,
              FIGURE_XML_ATTR_NAMES,
            ),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureNodeView);
  },
});

/**
 * S1000D `levelledPara`：与描述类 Schema 一致。
 * `title (warningAndCautionElemGroup|note|para|fmftElemGroup|table)* levelledPara*`
 */
export const LevelledPara = Node.create({
  name: "levelledPara",
  group: "block",
  content:
    "(title?) (warningAndCautionElemGroup | note | para | fmftElemGroup | table | bulletList | orderedList)* levelledPara*",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: s1000dIdAttributeConfig(),
    };
  },

  parseHTML() {
    const readLevelledParaId = (el: Element) =>
      el.getAttribute("id") ?? el.getAttribute("data-s1000d-element-id");

    return [
      {
        tag: "section",
        priority: 52,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          return el.getAttribute("data-s1000d-node") === "levelledPara"
            ? {
                id: readLevelledParaId(el),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, [
                  "id",
                  "data-s1000d-element-id",
                ]),
              }
            : false;
        },
      },
      {
        tag: "levelledPara",
        getAttrs: (el) =>
          el instanceof Element
            ? {
                id: readLevelledParaId(el),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, [
                  "id",
                  "data-s1000d-element-id",
                ]),
              }
            : {},
      },
      {
        tag: "levelledpara",
        getAttrs: (el) =>
          el instanceof Element
            ? {
                id: readLevelledParaId(el),
                [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, [
                  "id",
                  "data-s1000d-element-id",
                ]),
              }
            : {},
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["levelledPara", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LevelledParaNodeView);
  },
});

/** S1000D 描述类节点注册顺序（子类型先于引用它们的容器）。 */
export const s1000dPhase1Nodes = [
  S1000DSub,
  S1000DSup,
  S1000DEmphasis,
  AttentionListItemPara,
  AttentionRandomListItem,
  AttentionRandomList,
  WarningAndCautionLead,
  WarningAndCautionPara,
  S1000DWarning,
  S1000DCaution,
  NoteLead,
  NotePara,
  S1000DNote,
  S1000DTitle,
  S1000DPara,
  S1000DDmRef,
  S1000DInternalRef,
  S1000DGraphic,
  S1000DMultimediaObject,
  S1000DMultimedia,
  S1000DFigure,
  ...s1000dTableNodes,
  LevelledPara,
] as const;

/**
 * 使用浏览器原生 `DOMParser` 解析整段 DM XML 字符串，抽出首个 `<content>` 元素以备后续映射到编辑器。
 *
 * **注意**：本函数不写编辑器状态，只做 DOM 截取，保持「解析」与「状态更新」单向分离。
 *
 * @param xmlString DM 全文（可含 DOCTYPE、`identAndStatusSection`）；若缺失 `content` 则返回 `null`
 */
export function extractContentElementFromDmXml(
  xmlString: string,
): Element | null {
  const dmodule = getRootDModuleElement(xmlString);
  if (!dmodule) return null;

  const contentEl = Array.from(dmodule.children).find(
    (c) => c.localName === "content",
  );

  return contentEl ?? null;
}

export function extractIdentAndStatusSection(xmlString: string): void {
  const dmodule = getRootDModuleElement(xmlString);
  if (!dmodule) {
    useDmMetadataStore.getState().setIdentAndStatusXml("");
    return;
  }

  const identNode = Array.from(dmodule.children).find(
    (c) => c.localName === "identAndStatusSection",
  );

  if (identNode) {
    const serializer = new XMLSerializer();
    const identXmlString = serializer.serializeToString(identNode);
    useDmMetadataStore.getState().setIdentAndStatusXml(identXmlString);
  } else {
    useDmMetadataStore.getState().setIdentAndStatusXml("");
  }
}
/**
 * `warningAndCautionPara` 在 XML 里常将前导正文与 `<attentionRandomList>` 并排；
 * TipTap 需块级子节点，故在无 `warningAndCautionLead` 时把前一段包进该元素。
 * 仅处理已解析的描述类 DOM（如 `extractContentElementFromDmXml` 的产物），不写回源 XML 文件。
 */
function normalizeWarningAndCautionParasForEditor(descriptionRoot: Element) {
  const paras = Array.from(
    descriptionRoot.querySelectorAll("warningAndCautionPara"),
  );
  const DOM_ELEMENT = globalThis.Node.ELEMENT_NODE;
  const DOM_TEXT = globalThis.Node.TEXT_NODE;

  for (const para of paras) {
    if (para.querySelector(":scope > warningAndCautionLead")) continue;
    if (para.querySelector(":scope > warningandcautionlead")) continue;

    const toWrap: globalThis.ChildNode[] = [];
    let ref: globalThis.ChildNode | null = para.firstChild;
    while (ref) {
      if (
        ref.nodeType === DOM_ELEMENT &&
        ((ref as Element).localName === "attentionRandomList" ||
          (ref as Element).localName === "attentionrandomlist")
      ) {
        break;
      }
      const next = ref.nextSibling;
      toWrap.push(ref);
      ref = next;
    }

    const hasSubstance = toWrap.some((n) => {
      if (n.nodeType === DOM_TEXT) {
        return !!(n.textContent && n.textContent.trim());
      }
      return n.nodeType === DOM_ELEMENT;
    });
    if (!hasSubstance) continue;

    const owner = para.ownerDocument;
    const ns = para.namespaceURI;
    const lead = ns
      ? owner.createElementNS(ns, "warningAndCautionLead")
      : owner.createElement("warningAndCautionLead");
    for (const n of toWrap) lead.appendChild(n);
    para.insertBefore(lead, para.firstChild);
  }
}

/** 与 `normalizeWarningAndCautionParasForEditor` 同逻辑，用于 `notePara`。 */
function normalizeNoteParasForEditor(descriptionRoot: Element) {
  const paras = Array.from(descriptionRoot.querySelectorAll("notePara"));
  const DOM_ELEMENT = globalThis.Node.ELEMENT_NODE;
  const DOM_TEXT = globalThis.Node.TEXT_NODE;

  for (const para of paras) {
    if (para.querySelector(":scope > noteLead")) continue;
    if (para.querySelector(":scope > notelead")) continue;

    const toWrap: globalThis.ChildNode[] = [];
    let ref: globalThis.ChildNode | null = para.firstChild;
    while (ref) {
      if (
        ref.nodeType === DOM_ELEMENT &&
        ((ref as Element).localName === "attentionRandomList" ||
          (ref as Element).localName === "attentionrandomlist")
      ) {
        break;
      }
      const next = ref.nextSibling;
      toWrap.push(ref);
      ref = next;
    }

    const hasSubstance = toWrap.some((n) => {
      if (n.nodeType === DOM_TEXT) {
        return !!(n.textContent && n.textContent.trim());
      }
      return n.nodeType === DOM_ELEMENT;
    });
    if (!hasSubstance) continue;

    const owner = para.ownerDocument;
    const ns = para.namespaceURI;
    const lead = ns
      ? owner.createElementNS(ns, "noteLead")
      : owner.createElement("noteLead");
    for (const n of toWrap) lead.appendChild(n);
    para.insertBefore(lead, para.firstChild);
  }
}

function elementDepth(el: Element): number {
  let d = 0;
  let p: Element | null = el.parentElement;
  while (p) {
    d++;
    p = p.parentElement;
  }
  return d;
}

function renameXmlElementTag(el: Element, newName: string) {
  const doc = el.ownerDocument;
  if (!doc) return;
  const neu = doc.createElement(newName);
  for (const attr of Array.from(el.attributes)) {
    neu.setAttribute(attr.name, attr.value);
  }
  while (el.firstChild) {
    neu.appendChild(el.firstChild);
  }
  el.parentNode?.replaceChild(neu, el);
}

function isS1000dSequentialOrRandomListTag(ln: string): boolean {
  return ln === "sequentiallist" || ln === "randomlist";
}

function normalizeListItemParasBeforeListRename(item: Element) {
  const doc = item.ownerDocument;
  if (!doc) return;
  const paras = Array.from(item.children).filter(
    (c) => c.localName.toLowerCase() === "para",
  );
  for (const para of paras) {
    const blocks: Element[] = [];
    const inlineParts: globalThis.ChildNode[] = [];
    for (const n of Array.from(para.childNodes)) {
      if (n.nodeType === globalThis.Node.TEXT_NODE) {
        inlineParts.push(n);
        continue;
      }
      if (n.nodeType === globalThis.Node.ELEMENT_NODE) {
        const e = n as Element;
        const ln = e.localName.toLowerCase();
        if (isS1000dSequentialOrRandomListTag(ln)) {
          blocks.push(e);
        } else {
          inlineParts.push(n);
        }
      }
    }
    const meaningfulText = inlineParts.some(
      (n) =>
        n.nodeType === globalThis.Node.TEXT_NODE &&
        (n.textContent?.trim()?.length ?? 0) > 0,
    );
    const nonTextInline = inlineParts.some(
      (n) => n.nodeType === globalThis.Node.ELEMENT_NODE,
    );
    const frag = doc.createDocumentFragment();
    if (
      meaningfulText ||
      nonTextInline ||
      (inlineParts.length > 0 && blocks.length === 0)
    ) {
      const p = doc.createElement("p");
      copyElementAttributes(para, p);
      for (const n of inlineParts) p.appendChild(n);
      frag.appendChild(p);
    } else {
      for (const n of inlineParts) frag.appendChild(n);
    }
    for (const b of blocks) frag.appendChild(b);
    item.insertBefore(frag, para);
    para.remove();
  }
}

function normalizeMixedContentParas(description: Element) {
  const paras = Array.from(description.getElementsByTagName("para"));
  const doc = description.ownerDocument;
  if (!doc) return;

  for (const para of paras) {
    // 检查是否包含列表等块级元素
    let hasBlock = false;
    for (const child of Array.from(para.children)) {
      const ln = child.localName.toLowerCase();
      if (
        isS1000dSequentialOrRandomListTag(ln) ||
        ln === "figure" ||
        ln === "multimedia" ||
        ln === "table"
      ) {
        hasBlock = true;
        break;
      }
    }
    if (!hasBlock) continue;

    const parent = para.parentElement;
    if (!parent) continue;

    let currentParaContent: globalThis.Node[] = [];
    const flushPara = () => {
      if (currentParaContent.length > 0) {
        // 如果内部不仅是空白字符，则生成新的独立 para
        const hasSubstance = currentParaContent.some(
          (n) =>
            n.nodeType === globalThis.Node.ELEMENT_NODE ||
            (n.nodeType === globalThis.Node.TEXT_NODE &&
              n.textContent?.trim() !== ""),
        );
        if (hasSubstance) {
          const newPara = doc.createElement("para");
          for (const n of currentParaContent) newPara.appendChild(n);
          parent.insertBefore(newPara, para);
        }
        currentParaContent = [];
      }
    };

    // 遍历所有子节点（包含 Text 节点），遇到 block 则截断 para
    for (const node of Array.from(para.childNodes)) {
      if (node.nodeType === globalThis.Node.ELEMENT_NODE) {
        const ln = (node as Element).localName.toLowerCase();
        if (
          isS1000dSequentialOrRandomListTag(ln) ||
          ln === "figure" ||
          ln === "multimedia" ||
          ln === "table"
        ) {
          flushPara();
          parent.insertBefore(node, para); // 块级元素提升到与 para 同级
          continue;
        }
      }
      currentParaContent.push(node);
    }
    flushPara();
    parent.removeChild(para); // 移除原始的混合 content para
  }
}

/**
 * 将描述 DOM 中的 S1000D 列表转为 HTML `ol`/`ul`/`li`/`p`，以便 StarterKit 列表与 `para` 的 `inline*` 共存。
 * 须在序列化为 HTML 导入字符串之前、在已解析的 `description` 元素上调用。
 */
function normalizeS1000dListsForEditor(descriptionRoot: Element) {
  const listItems = Array.from(
    descriptionRoot.getElementsByTagName("listItem"),
  );
  for (const item of listItems) {
    normalizeListItemParasBeforeListRename(item);
  }

  normalizeMixedContentParas(descriptionRoot);

  const sequentialLists = Array.from(
    descriptionRoot.getElementsByTagName("sequentialList"),
  );
  sequentialLists.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const el of sequentialLists) renameXmlElementTag(el, "ol");

  const randomLists = Array.from(
    descriptionRoot.getElementsByTagName("randomList"),
  );
  randomLists.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const el of randomLists) renameXmlElementTag(el, "ul");

  const liAgain = Array.from(descriptionRoot.getElementsByTagName("listItem"));
  liAgain.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const el of liAgain) renameXmlElementTag(el, "li");
}

/**
 * DOM `text/html` 会与文档 `<title>` 冲突或不保留 body 内的 `<title>`，导入前将片段中的 S1000D
 * `title` 换为 `s1000d-block-title`（由 `S1000DTitle.parseHTML` 识别）。
 */
function renameS1000dTitleTagsForHtmlImport(fragmentXml: string): string {
  return fragmentXml
    .replace(/<title(\s[^>]*)?>/gi, "<s1000d-block-title$1>")
    .replace(/<\/title>/gi, "</s1000d-block-title>");
}

/**
 * HTML 解析不认 XML 自闭合：`<para/>`、`<s1000d-block-title/>` 会变成未闭合起始标签，
 * tbody/td 内外结构错乱，整段易被当成段落纯文本渲染。
 */
function normalizeS1000dSelfClosingElementsForHtmlImport(s: string): string {
  return s.replace(/<([a-zA-Z0-9_-]+)([^>]*?)\s*\/\s*>/g, "<$1$2></$1>");
}

/** 用户若粘贴完整 HTML 文档，去掉不参与正文的包裹标签以免干扰解析（如尾随 `</body>`）。 */
function stripHtmlDocumentWrapperTags(fragment: string): string {
  return fragment.replace(/<\/?\s*(html|head|body)\b[^>]*>\s*/gi, "");
}

function escapeAttrForQuotedDouble(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** 剥离 tgroup 上已提取到 data-s1000d-tgroup-cols 的 cols 属性，避免写入 HTML table 后与 class 语义重复 */
function stripTgroupColsAttr(attrs: string): string {
  return attrs
    .replace(/\bcols\s*=\s*"[^"]*"/gi, "")
    .replace(/\bcols\s*=\s*'[^']*'/gi, "")
    .replace(/\bcols\s*=\s*[^\s>]*/gi, "")
    .trim();
}

/**
 * XML 内部的 <tgroup>…</tgroup> 转为「内层表格」：`table.s1000d-tgroup-table` + thead/tbody + tr/td，
 * 供现有 `parseHTML` 吃进 `tgroup` / `row` / `entry` 等价结构。
 */
function convertS1000dTableInnerToHtml(innerXml: string): string {
  let s = innerXml.replace(/<\s*tgroup\b([^>]*)>/gi, (_full, attrs: string) => {
    let colsVal = "";
    const q = /\bcols\s*=\s*(["'])((?:\\.|[^\\])*?)\1/i.exec(attrs) ?? null;
    if (q?.[2] != null && q[2].length > 0) {
      colsVal = q[2];
    } else {
      const u = /\bcols\s*=\s*(\S+)/i.exec(attrs);
      if (u?.[1]) {
        colsVal = u[1].replace(/^["']/g, "").replace(/["']$/g, "");
      }
    }
    const rest = stripTgroupColsAttr(attrs);
    const tail = rest ? ` ${rest}` : "";
    return `<table class="s1000d-tgroup-table"${tail} data-s1000d-tgroup-cols="${escapeAttrForQuotedDouble(colsVal)}">`;
  });
  s = s.replace(/<\/\s*tgroup\s*>/gi, "</table>");
  s = s.replace(/<\s*row\b([^>]*)>/gi, "<tr$1>");
  s = s.replace(/<\/\s*row\s*>/gi, "</tr>");
  s = s.replace(/<\s*entry\b([^>]*)>/gi, "<td$1>");
  s = s.replace(/<\/\s*entry\s*>/gi, "</td>");
  return s;
}

/** 已由 `convertS1000dTableInnerToHtml` 生成的内层网格表，不得再按「外层 S1000D table」二次包裹，否则 `setContent(getHTML())` 会破坏 DOM，整段落成纯文本。 */
function isS1000dTgroupGridTableOpenTag(openTagFull: string): boolean {
  return /\bs1000d-tgroup-table\b/i.test(openTagFull);
}

/** 从 `<table` 起始位置起，找到与之平衡的 `</table>` 结束位置（不含闭合标签本身）。 */
function findBalancedTableCloseRange(
  fragment: string,
  lower: string,
  innerStart: number,
): { innerEndCloseStart: number; closeLen: number } | null {
  let depth = 1;
  let pos = innerStart;
  let innerEndCloseStart = -1;
  while (depth > 0 && pos < fragment.length) {
    const iOpen = lower.indexOf("<table", pos);
    const iClose = lower.indexOf("</table>", pos);
    if (iClose === -1) break;

    const hasInnerOpen = iOpen !== -1 && iOpen < iClose;

    if (hasInnerOpen) {
      depth += 1;
      const gt = fragment.indexOf(">", iOpen);
      pos = gt === -1 ? iOpen + 6 : gt + 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        innerEndCloseStart = iClose;
        break;
      }
      const gt = fragment.indexOf(">", iClose);
      pos = gt === -1 ? iClose + 8 : gt + 1;
    }
  }

  if (innerEndCloseStart === -1) return null;

  const closePiece = fragment.slice(innerEndCloseStart);
  const closeMatch = /<\/\s*table\s*>/.exec(closePiece);
  const closeLen = closeMatch?.[0]?.length ?? 8;
  return { innerEndCloseStart, closeLen };
}

/** 外层 S1000D `<table>...</table>` 用 div 包住，并把 tgroup 等转为浏览器可接受的表格 HTML，否则 text/html 会 foster 掉非法子节点导致整段成纯文本 */
function sanitizeS1000dXmlTablesForHtmlImport(fragment: string): string {
  const lower = fragment.toLowerCase();
  let out = "";
  let cursor = 0;

  while (cursor < fragment.length) {
    const openIdx = lower.indexOf("<table", cursor);
    if (openIdx === -1) {
      out += fragment.slice(cursor);
      return out;
    }
    out += fragment.slice(cursor, openIdx);

    const gtIdx = fragment.indexOf(">", openIdx);
    if (gtIdx === -1) {
      out += fragment.slice(openIdx);
      return out;
    }
    const openTagFull = fragment.slice(openIdx, gtIdx + 1);
    const innerStart = gtIdx + 1;

    const balanced = findBalancedTableCloseRange(fragment, lower, innerStart);
    if (!balanced) {
      out += fragment.slice(openIdx);
      cursor = fragment.length;
      continue;
    }
    const { innerEndCloseStart, closeLen } = balanced;

    /** 内层 tgroup 渲染表：原样拷贝，避免二次 sanitize 把结构撕碎 */
    if (isS1000dTgroupGridTableOpenTag(openTagFull)) {
      out += fragment.slice(openIdx, innerEndCloseStart + closeLen);
      cursor = innerEndCloseStart + closeLen;
      continue;
    }

    const innerXml = fragment.slice(innerStart, innerEndCloseStart);
    const idM = /\bid\s*=\s*(["'])(.*?)\1/i.exec(openTagFull);
    const idAttr = idM ? ` id="${escapeAttrForQuotedDouble(idM[2])}"` : "";
    const innerHtml = convertS1000dTableInnerToHtml(innerXml);
    out += `<div data-s1000d-xml-table="1"${idAttr}>${innerHtml}</div>`;

    cursor = innerEndCloseStart + closeLen;
  }

  return out;
}

/**
 * 供 `editor.setContent(...)`（HTML）前调用：将与 XML 等价但 HTML 不认的片段整理好。
 */
export function preprocessS1000dDescriptionHtmlFragment(
  fragmentXml: string,
): string {
  const stripped = stripHtmlDocumentWrapperTags(fragmentXml.trim());
  const body = sanitizeS1000dXmlTablesForHtmlImport(
    normalizeS1000dSelfClosingElementsForHtmlImport(
      renameS1000dTitleTagsForHtmlImport(stripped),
    ),
  );
  return body;
}

/**
 * 从 DM 正文字符串中取出可用于 `editor.setContent` 的片段：
 * 截取 `<content>` → `<description>` 的**直接子节点**，序列化为连续 XML 字符串（无 `<description>` 外壳）。
 * Tiptap 将按各扩展的 `parseHTML` 导入；**不向编辑器注入** `identAndStatusSection`。
 */
export function getDescriptionInnerXmlFromDmXml(
  xmlString: string,
): string | null {
  extractIdentAndStatusSection(xmlString);
  const contentRoot = extractContentElementFromDmXml(xmlString);
  if (!contentRoot) return null;
  const description = Array.from(contentRoot.children).find(
    (c) => c.localName === "description",
  );
  if (!description) return null;

  normalizeWarningAndCautionParasForEditor(description);
  normalizeNoteParasForEditor(description);
  normalizeS1000dListsForEditor(description);

  const BLOCK_TAGS = [
    "table",
    "tgroup",
    "thead",
    "tbody",
    "row",
    "tr",
    "figure",
    "multimedia",
    "multimediaobject",
    "warning",
    "caution",
    "note",
    "levelledpara",
    "para",
  ];
  function cleanEmptyTextNodes(node: globalThis.Node) {
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i];
      if (
        child.nodeType === globalThis.Node.TEXT_NODE &&
        !child.textContent?.trim()
      ) {
        const parentName = (node as Element).localName?.toLowerCase();
        // 只有当父级是块级元素时，才允许删除其内部的无意义空文本
        if (parentName && BLOCK_TAGS.includes(parentName)) {
          node.removeChild(child);
        }
      } else if (child.nodeType === globalThis.Node.ELEMENT_NODE) {
        cleanEmptyTextNodes(child);
      }
    }
  }
  cleanEmptyTextNodes(description);

  const serializer = new XMLSerializer();

  const atomNodes = description.querySelectorAll("dmRef");
  atomNodes.forEach((node) => {
    // 此时拿到的是完美的 camelCase XML 字符串，包含 <dmRef> 标签本身
    const pureXml = serializer.serializeToString(node);
    // 编码后放入 data-raw-xml 属性中，防止 HTML parser 破坏
    node.setAttribute("data-raw-xml", encodeURIComponent(pureXml));
  });

  const parts: string[] = [];
  for (const child of Array.from(description.children)) {
    parts.push(serializer.serializeToString(child));
  }
  const joined = parts.length > 0 ? parts.join("") : null;
  if (!joined) return null;
  return preprocessS1000dDescriptionHtmlFragment(joined);
}

/**
 * 从 DM 中取出 `<content>/<faultIsolation>` 的直接子节点 XML 片段（无 `<faultIsolation>` 外壳）。
 */
export function getFaultIsolationInnerXmlFromDmXml(
  xmlString: string,
): string | null {
  extractIdentAndStatusSection(xmlString);
  const contentRoot = extractContentElementFromDmXml(xmlString);
  if (!contentRoot) return null;
  const faultIsolation = Array.from(contentRoot.children).find(
    (c) => c.localName === "faultIsolation",
  );
  if (!faultIsolation) return null;

  const serializer = new XMLSerializer();
  const parts: string[] = [];
  for (const child of Array.from(faultIsolation.children)) {
    parts.push(serializer.serializeToString(child));
  }
  const joined = parts.length > 0 ? parts.join("") : null;
  if (!joined) return null;
  return preprocessS1000dDescriptionHtmlFragment(joined);
}

/**
 * 按 schema 正文类型从 DM 抽取可 `setContent` 的片段；类型不匹配时尝试另一种根元素。
 */
export function getDmInnerXmlFromDmXml(
  xmlString: string,
  preferFaultIsolation: boolean,
): string | null {
  const description = getDescriptionInnerXmlFromDmXml(xmlString);
  const fault = getFaultIsolationInnerXmlFromDmXml(xmlString);
  if (preferFaultIsolation) {
    return fault ?? description;
  }
  return description ?? fault;
}

/**
 * 核心公共方法：安全解析 S1000D XML 字符串，并返回 `<dmodule>` 根节点 DOM。
 * 集中处理了 BOM 头、多余的非 XML 字符，以及解析器异常兜底。
 * * @param xmlString 原始的 DM XML 字符串
 * @returns Element | null 如果解析成功，返回 dmodule 节点；失败则返回 null
 */
export function getRootDModuleElement(xmlString: string): Element | null {
  const trimmed = xmlString.replace(/^\uFEFF/, "");
  // 忽略头部可能存在的无关字符，直接找到 <dmodule 开头
  const dmStart = trimmed.search(/<\s*dmodule\b/i);
  const toParse = dmStart >= 0 ? trimmed.slice(dmStart) : trimmed;

  const doc = new DOMParser().parseFromString(toParse, "application/xml");

  // 集中处理解析报错
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    console.error("S1000D XML 解析失败:", parserError.textContent);
    return null;
  }

  const dmodule =
    doc.documentElement.localName === "dmodule"
      ? doc.documentElement
      : doc.querySelector("dmodule");

  return dmodule ?? null;
}
