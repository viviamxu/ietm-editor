import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import { getInnermostLevelledParaDepth } from "../editor/nestingLevelShared";
import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import { useInternalRefModalStore } from "../../store/internalRefModalStore";
import type { DescriptionSchema } from "../../types/descriptionSchema";
import { getDmContentKind } from "./dmContentKind";
import { buildEmptyDocJsonFromSchema } from "./dmEmptyContent";
import { useDmMetadataStore } from "../../store/dmMetadataStore";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

function isInsideNodeType(editor: Editor, nodeTypeName: string): boolean {
  const $from = editor.state.selection.$from;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === nodeTypeName) return true;
  }
  return false;
}

/** 内容模型字符串中是否出现独立 token（粗匹配，供插入前校验） */
function contentRuleMentions(rule: string | undefined, token: string): boolean {
  if (!rule) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(rule);
}

function requireSchemaNode(schema: DescriptionSchema, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, name);
}

function focusFirstCellByMouseLikeClick(editor: Editor): void {
  setTimeout(() => {
    const root = editor.view.dom as HTMLElement;
    const tables = root.querySelectorAll(
      ".s1000d-table-wrap, .s1000d-tgroup-table",
    );
    const latestTable = tables.item(tables.length - 1) as HTMLElement | null;
    if (!latestTable) return;

    const firstCell = latestTable.querySelector(
      ".s1000d-entry, td, th",
    ) as HTMLElement | null;
    if (!firstCell) return;

    firstCell.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    firstCell.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    firstCell.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  }, 0);
}

/**
 * 按当前描述类 schema 的 `levelledPara.content` 组装最小可编辑片段。
 * 默认规则含 `title` 与 `para` 时各插入一个空块；无 `content` 字段时回退为 title + para。
 */
export function buildInsertLevelledParaJson(
  schema: DescriptionSchema,
): JSONContent | null {
  if (!requireSchemaNode(schema, "levelledPara")) return null;
  const rule = schema.levelledPara?.content ?? "";
  const children: JSONContent[] = [];

  if (rule === "" || /\btitle\??/.test(rule)) {
    children.push({ type: "title", content: [] });
  }
  if (rule === "" || /\bpara\b/.test(rule)) {
    children.push({ type: "para", content: [] });
  }
  if (children.length === 0) {
    return {
      type: "levelledPara",
      content: [
        { type: "title", content: [] },
        { type: "para", content: [] },
      ],
    };
  }

  return { type: "levelledPara", content: children };
}

/**
 * 光标落在 `levelledPara` 的哪一个直接子节点上（含块边界缝：标题行尾等）。
 */
function getLevelledParaDirectChildIndex(
  $from: ResolvedPos,
  lpDepth: number,
): number {
  const lp = $from.node(lpDepth);
  const lpStart = $from.before(lpDepth);
  const pos = $from.pos;
  if (lp.childCount === 0) return -1;

  const ranges: { start: number; end: number }[] = [];
  let offset = lpStart + 1;
  for (let i = 0; i < lp.childCount; i++) {
    const child = lp.child(i);
    ranges.push({ start: offset, end: offset + child.nodeSize });
    offset += child.nodeSize;
  }

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i]!;
    if (pos > start && pos < end) return i;
  }
  for (let i = 0; i < ranges.length; i++) {
    if (pos === ranges[i]!.end) return i;
  }
  for (let i = 0; i < ranges.length; i++) {
    if (pos === ranges[i]!.start) return i;
  }
  return ranges.length - 1;
}

function selectionInLevelledParaTitle(
  doc: PMNode,
  levelledParaPos: number,
): TextSelection | null {
  const node = doc.nodeAt(levelledParaPos);
  if (!node || node.type.name !== "levelledPara") return null;

  let offset = levelledParaPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "title") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  const fallback = Math.min(levelledParaPos + 2, doc.content.size);
  if (fallback < 0 || fallback > doc.content.size) return null;
  return TextSelection.create(doc, fallback);
}

/**
 * 拆分光标所在的最内层 `levelledPara` 并插入同级块：
 * 原块保留「光标所在直接子节点及之前」；新块以空 title 开头并承接之后的直接子节点。
 */
function splitLevelledParaAndInsertSibling(
  $from: ResolvedPos,
  lpDepth: number,
  lpType: PMNode["type"],
  titleType: PMNode["type"],
): { left: PMNode; right: PMNode } | null {
  const lp = $from.node(lpDepth);
  const splitIndex = getLevelledParaDirectChildIndex($from, lpDepth);
  if (splitIndex < 0) return null;

  const leftChildren: PMNode[] = [];
  for (let i = 0; i <= splitIndex; i++) {
    leftChildren.push(lp.child(i));
  }

  const movedChildren: PMNode[] = [];
  for (let i = splitIndex + 1; i < lp.childCount; i++) {
    movedChildren.push(lp.child(i));
  }

  const emptyTitle = titleType.create(null, []);
  const rightChildren = [emptyTitle, ...movedChildren];

  try {
    const left = lpType.create(lp.attrs, Fragment.from(leftChildren));
    const right = lpType.create(lp.attrs, Fragment.from(rightChildren));
    if (
      !left.type.validContent(left.content) ||
      !right.type.validContent(right.content)
    ) {
      return null;
    }
    return { left, right };
  } catch {
    return null;
  }
}

export function insertLevelledParaFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!requireSchemaNode(schema, "levelledPara")) return false;

  const lpType = editor.state.schema.nodes.levelledPara;
  const titleType = editor.state.schema.nodes.title;
  if (!lpType || !titleType) return false;

  if (getInnermostLevelledParaDepth(editor.state.selection.$from) < 0) {
    const json = buildInsertLevelledParaJson(schema);
    if (!json) return false;
    return editor.chain().focus().insertContent(json).run();
  }

  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      const lpDepth = getInnermostLevelledParaDepth($from);
      if (lpDepth < 0) return false;

      const split = splitLevelledParaAndInsertSibling(
        $from,
        lpDepth,
        lpType,
        titleType,
      );
      if (!split) return false;

      if (!dispatch) return true;

      const from = $from.before(lpDepth);
      const to = $from.after(lpDepth);
      tr.replaceWith(from, to, [split.left, split.right]);

      const newSiblingPos = from + split.left.nodeSize;
      const sel = selectionInLevelledParaTitle(tr.doc, newSiblingPos);
      if (sel) tr.setSelection(sel);

      dispatch(tr);
      return true;
    })
    .run();
}

/** 在光标处插入空 `para`（描述类正文段落块）。 */
export function insertParagraphFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!requireSchemaNode(schema, "para")) return false;
  return editor.chain().focus().insertContent({ type: "para", content: [] }).run();
}

/** sequentialList：schema 要求 `listItem+`；编辑器映射为 orderedList → listItem → paragraph */
export function insertSequentialListFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!requireSchemaNode(schema, "sequentialList")) return false;
  if (!contentRuleMentions(schema.sequentialList?.content, "listItem"))
    return false;

  return editor
    .chain()
    .focus()
    .insertContent({
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [] }],
        },
      ],
    })
    .run();
}

const attentionRandomListInsertJson: JSONContent = {
  type: "attentionRandomList",
  content: [
    {
      type: "attentionRandomListItem",
      content: [{ type: "attentionListItemPara", content: [] }],
    },
  ],
};

const attentionRandomListItemInsertJson: JSONContent = {
  type: "attentionRandomListItem",
  content: [{ type: "attentionListItemPara", content: [] }],
};

/**
 * 在 `warningAndCautionPara` / `notePara` 内插入 attention 列表：必须用文档坐标插入，
 * 否则选区若在 lead（inline*）内，`insertContent` 会把块级列表挤到 para 外。
 */
function resolveAttentionInsertInAttentionPara(
  $from: ResolvedPos,
  paraTypeName: "warningAndCautionPara" | "notePara",
):
  | { insertPos: number; json: JSONContent; inserted: "fullList" | "singleItem" }
  | null {
  let paraDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === paraTypeName) {
      paraDepth = d;
      break;
    }
  }
  if (paraDepth < 0) return null;

  const paraNode = $from.node(paraDepth);
  const paraStart = $from.before(paraDepth);

  let childPos = paraStart + 1;
  for (let i = 0; i < paraNode.childCount; i++) {
    const child = paraNode.child(i);
    if (child.type.name === "attentionRandomList") {
      const insertPos = childPos + 1 + child.content.size;
      return {
        insertPos,
        json: attentionRandomListItemInsertJson,
        inserted: "singleItem",
      };
    }
    childPos += child.nodeSize;
  }

  const insertPos = paraStart + 1 + paraNode.content.size;
  return {
    insertPos,
    json: attentionRandomListInsertJson,
    inserted: "fullList",
  };
}

/** 光标落到新插入项的 `attentionListItemPara` 行内起点。 */
function selectionAfterAttentionInsert(
  doc: PMNode,
  insertPos: number,
  inserted: "fullList" | "singleItem",
): TextSelection | null {
  const itemStart = inserted === "fullList" ? insertPos + 1 : insertPos;
  const item = doc.nodeAt(itemStart);
  if (!item || item.type.name !== "attentionRandomListItem") return null;
  const para = item.firstChild;
  if (!para || para.type.name !== "attentionListItemPara") return null;
  const caret = itemStart + 1 + 1;
  if (caret < 0 || caret > doc.content.size) return null;
  return TextSelection.create(doc, caret);
}

/** randomList；在 warning/caution 正文中插入 attentionRandomList（schema 未单独建模时仍允许）。 */
export function insertRandomOrAttentionListFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const attentionParaType = isInsideNodeType(editor, "warningAndCautionPara")
    ? ("warningAndCautionPara" as const)
    : isInsideNodeType(editor, "notePara")
      ? ("notePara" as const)
      : null;

  if (attentionParaType) {
    const resolved = resolveAttentionInsertInAttentionPara(
      editor.state.selection.$from,
      attentionParaType,
    );
    if (!resolved) return false;

    return editor
      .chain()
      .focus()
      .command(({ tr, state, dispatch }) => {
        let node: PMNode;
        try {
          node = PMNode.fromJSON(state.schema, resolved.json);
        } catch {
          return false;
        }
        if (!dispatch) return true;
        tr.insert(resolved.insertPos, node);
        const sel = selectionAfterAttentionInsert(
          tr.doc,
          resolved.insertPos,
          resolved.inserted,
        );
        if (sel) tr.setSelection(sel);
        dispatch(tr);
        return true;
      })
      .run();
  }

  if (!requireSchemaNode(schema, "randomList")) return false;
  if (!contentRuleMentions(schema.randomList?.content, "listItem"))
    return false;

  return editor
    .chain()
    .focus()
    .insertContent({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [] }],
        },
      ],
    })
    .run();
}

export function insertTableFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
  cols: number,
  headerRowCount: number,
  bodyRows: number,
): boolean {
  if (!requireSchemaNode(schema, "table")) return false;
  const tableRule = schema.table?.content ?? "";
  const includeEmptyTitle = tableRule === "" || /\btitle/.test(tableRule);
  const json = createMinimalS1000dTableInsertJson(
    cols,
    headerRowCount,
    bodyRows,
    includeEmptyTitle,
  );
  const inserted = editor.chain().focus().insertContent(json).run();
  if (inserted) {
    focusFirstCellByMouseLikeClick(editor);
  }
  return inserted;
}

export function insertFilmFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): void {
  void schema;
  useInsertPublicationModalStore.getState().openInsertPublication(
    editor,
    "multimedia",
  );
}

export function insertImageFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): void {
  void schema;
  useInsertPublicationModalStore
    .getState()
    .openInsertPublication(editor, "image");
}

/** 可编辑前导正文（对应 schema `warningAndCautionPara` 的 `text*`，导出时剥壳） */
function buildMinimalWarningAndCautionParaJson(): JSONContent {
  return {
    type: "warningAndCautionPara",
    content: [{ type: "warningAndCautionLead", content: [] }],
  };
}

/** `warning`：`warningAndCautionPara+`（schema 描述类规则） */
export function buildInsertWarningJson(
  schema: DescriptionSchema,
): JSONContent | null {
  if (!requireSchemaNode(schema, "warning")) return null;
  if (!contentRuleMentions(schema.warning?.content, "warningAndCautionPara"))
    return null;
  return {
    type: "warning",
    content: [buildMinimalWarningAndCautionParaJson()],
  };
}

/** `caution`：与 `warning` 同形 */
export function buildInsertCautionJson(
  schema: DescriptionSchema,
): JSONContent | null {
  if (!requireSchemaNode(schema, "caution")) return null;
  if (!contentRuleMentions(schema.caution?.content, "warningAndCautionPara"))
    return null;
  return {
    type: "caution",
    content: [buildMinimalWarningAndCautionParaJson()],
  };
}

export function insertWarningFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const node = buildInsertWarningJson(schema);
  if (!node) return false;
  return editor.chain().focus().insertContent(node).run();
}

export function insertCautionFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const node = buildInsertCautionJson(schema);
  if (!node) return false;
  return editor.chain().focus().insertContent(node).run();
}

const attentionListItemParaEmpty: JSONContent = {
  type: "attentionListItemPara",
  content: [],
};

function buildMinimalNoteParaJson(): JSONContent {
  return {
    type: "notePara",
    content: [
      { type: "noteLead", content: [] },
      {
        type: "attentionRandomList",
        content: [
          {
            type: "attentionRandomListItem",
            content: [attentionListItemParaEmpty],
          },
        ],
      },
    ],
  };
}

/** `note`：`notePara+`（schema 描述类规则） */
export function buildInsertNoteJson(
  schema: DescriptionSchema,
): JSONContent | null {
  if (!requireSchemaNode(schema, "note")) return null;
  if (!contentRuleMentions(schema.note?.content, "notePara")) return null;
  return {
    type: "note",
    content: [buildMinimalNoteParaJson()],
  };
}

export function insertNoteFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const node = buildInsertNoteJson(schema);
  if (!node) return false;
  return editor.chain().focus().insertContent(node).run();
}

/** 满足 `description.content` 中 `attentionElemGroup` 分支的最小块（warning / caution / note）。 */
function buildMinimalAttentionElemChild(
  schema: DescriptionSchema,
): JSONContent | null {
  if (requireSchemaNode(schema, "warning")) {
    return {
      type: "warning",
      content: [buildMinimalWarningAndCautionParaJson()],
    };
  }
  if (requireSchemaNode(schema, "caution")) {
    return {
      type: "caution",
      content: [buildMinimalWarningAndCautionParaJson()],
    };
  }
  if (requireSchemaNode(schema, "note")) {
    return {
      type: "note",
      content: [buildMinimalNoteParaJson()],
    };
  }
  return null;
}

/** 满足 `fmftElemGroup` 的最小块：优先 `figure`（含一个 `graphic`），否则最小 `table`。 */
function buildMinimalFmftElemChild(
  schema: DescriptionSchema,
): JSONContent | null {
  if (requireSchemaNode(schema, "multimedia")) {
    return {
      type: "multimedia",
      content: [
        { type: "multimediaObject", attrs: { infoEntityIdent: "" } },
      ],
    };
  }
  if (requireSchemaNode(schema, "figure")) {
    return {
      type: "figure",
      content: [{ type: "graphic", attrs: { src: "" } }],
    };
  }
  if (requireSchemaNode(schema, "table")) {
    return createMinimalS1000dTableInsertJson(1, 0, 1, false);
  }
  return null;
}

/**
 * 按描述类 schema 的 `description.content` 组装最小合法正文子节点数组
 *（对应 DM 中 `<content>/<description>` 下的块序列，不含 `identAndStatusSection`）。
 */
export function buildEmptyDescriptionBodyFromSchema(
  schema: DescriptionSchema,
): JSONContent[] {
  const rule = schema.description?.content ?? "";
  const leading: JSONContent[] = [];

  const wantsPara = rule === "" || contentRuleMentions(rule, "para");
  const wantsAttention = contentRuleMentions(rule, "attentionElemGroup");
  const wantsFmft = contentRuleMentions(rule, "fmftElemGroup");

  if (wantsPara && requireSchemaNode(schema, "para")) {
    leading.push({ type: "para", content: [] });
  } else if (wantsAttention) {
    const n = buildMinimalAttentionElemChild(schema);
    if (n) leading.push(n);
  } else if (wantsFmft) {
    const n = buildMinimalFmftElemChild(schema);
    if (n) leading.push(n);
  }

  if (leading.length === 0) {
    if (requireSchemaNode(schema, "para")) {
      leading.push({ type: "para", content: [] });
    } else {
      const n =
        buildMinimalAttentionElemChild(schema) ??
        buildMinimalFmftElemChild(schema);
      if (n) leading.push(n);
    }
  }

  if (leading.length === 0) {
    leading.push({ type: "para", content: [] });
  }

  return leading;
}

/** 供 `setContent` 使用的整篇「仅 description 正文」文档 JSON（根为 `doc`）。 */
export function buildEmptyDescriptionDocJson(
  schema: DescriptionSchema,
): JSONContent {
  return { type: "doc", content: buildEmptyDescriptionBodyFromSchema(schema) };
}

/**
 * 转义 XML 特殊字符，防止破坏文档结构
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * 💡 辅助函数：深度探测节点是否包含“实质性内容”
 * 彻底拦截并销毁 Tiptap 产生的无意义空壳节点（如多敲的回车、空列表项）
 */
function hasEffectiveContent(node: JSONContent): boolean {
  if (node.type === "text" && node.text?.trim() !== "") return true;
  if (
    node.type === "image" ||
    node.type === "graphic" ||
    node.type === "multimedia" ||
    node.type === "multimediaObject" ||
    (node.attrs && node.attrs.rawXml)
  )
    return true;
  if (node.type === "table") return true; // 表格等大结构默认保留
  if (node.content && node.content.length > 0) {
    return node.content.some(hasEffectiveContent);
  }
  return false;
}

const ignoredExportAttrs = [
  "class",
  "rawXml",
  "displayLevel",
  "start",
  "sourceXmlAttrKeys",
  "src",
  /** 仅编辑器 WYSIWYG；不写入 S1000D XML */
  "textAlign",
];
const listNodeTypes = [
  "bulletList",
  "orderedList",
  "randomList",
  "sequentialList",
];

function isListNode(node: JSONContent): boolean {
  return listNodeTypes.includes(node.type || "");
}

function buildAttrsString(attrs: JSONContent["attrs"]): string {
  if (!attrs) return "";

  let attrsStr = "";
  for (const [key, value] of Object.entries(attrs)) {
    if (
      value !== null &&
      value !== undefined &&
      !ignoredExportAttrs.includes(key)
    ) {
      attrsStr += ` ${key}="${escapeXml(String(value))}"`;
    }
  }
  return attrsStr;
}

function appendListRunAsPara(parts: string[], run: string[]): void {
  if (run.length === 0) return;
  parts.push(`<para>${run.join("")}</para>`);
  run.length = 0;
}

function isParaNode(node: JSONContent): boolean {
  return node.type === "paragraph" || node.type === "para";
}

/**
 * 将块级 sequentialList/randomList（编辑器中为 orderedList/bulletList）包入 `<para>` 再输出。
 * S1000D 要求 listElemGroup 位于 `para` 内；导入时列表会被提升为与 `para` 并列的块，导出需还原。
 */
function serializeChildrenWithListsWrappedInPara(node: JSONContent): string {
  const parts: string[] = [];
  const listRun: string[] = [];

  for (const child of node.content || []) {
    if (isListNode(child)) {
      const listXml = serializeNodeToXml(child);
      if (listXml) listRun.push(listXml);
      continue;
    }

    appendListRunAsPara(parts, listRun);
    parts.push(serializeNodeToXml(child));
  }

  appendListRunAsPara(parts, listRun);
  return parts.join("");
}

function serializeChildrenToXml(node: JSONContent): string {
  if (node.type === "entry") {
    const children = node.content || [];
    if (children.length === 0) return "<para />";

    return children
      .map((child) => {
        if (isParaNode(child) && !hasEffectiveContent(child)) {
          return "<para />";
        }
        return serializeNodeToXml(child);
      })
      .join("");
  }

  if (node.type === "levelledPara" || node.type === "doc") {
    return serializeChildrenWithListsWrappedInPara(node);
  }

  return (node.content || []).map(serializeNodeToXml).join("");
}

function buildGraphicEntityDoctype(contentXml: string): string {
  const graphicIds = Array.from(
    contentXml.matchAll(/\binfoEntityIdent="([^"]+)"/g),
  )
    .map((match) => match[1])
    .filter((id): id is string => !!id && id !== "XXXXXX");

  if (graphicIds.length === 0) {
    return `<!DOCTYPE dmodule [
   <!ENTITY ICN-C0419-S1000D0392-001-01 SYSTEM "ICN-C0419-S1000D0392-001-01.CGM" NDATA cgm >
   <!NOTATION cgm PUBLIC "-//USA-DOD//NOTATION Computer Graphics Metafile//EN" >
]>`;
  }

  const entities = [...new Set(graphicIds)]
    .map((id) => `   <!ENTITY ${id} SYSTEM "${id}.CGM" NDATA cgm >`)
    .join("\n");

  return `<!DOCTYPE dmodule [
${entities}
   <!NOTATION cgm PUBLIC "-//USA-DOD//NOTATION Computer Graphics Metafile//EN" >
]>`;
}

/**
 * 递归遍历 Tiptap JSON AST，将其还原为 S1000D XML 字符串
 */
function getTgroupCols(node: JSONContent): number {
  const attrCols = Number.parseInt(String(node.attrs?.cols ?? ""), 10);
  if (!Number.isNaN(attrCols) && attrCols > 0) return attrCols;

  const section = node.content?.find(
    (child) => child.type === "tbody" || child.type === "thead",
  );
  const row = section?.content?.find((child) => child.type === "row");
  return Math.max(
    1,
    row?.content?.filter((child) => child.type === "entry").length ?? 1,
  );
}

function buildColspecXml(cols: number): string {
  return Array.from({ length: cols }, (_, index) => {
    const n = index + 1;
    return `<colspec colname="col${n}" colnum="${n}" />`;
  }).join("");
}

function serializeMultimediaObjectToXml(attrs: JSONContent["attrs"]): string {
  if (!attrs) return "<multimediaObject></multimediaObject>";
  const iei =
    attrs.infoEntityIdent != null &&
    String(attrs.infoEntityIdent).trim() !== ""
      ? ` infoEntityIdent="${escapeXml(String(attrs.infoEntityIdent))}"`
      : "";
  return `<multimediaObject${iei}></multimediaObject>`;
}

function serializeGraphicToXml(attrs: JSONContent["attrs"]): string {
  if (!attrs) return "<graphic />";
  const id =
    attrs.id != null && String(attrs.id).trim() !== ""
      ? ` id="${escapeXml(String(attrs.id))}"`
      : "";
  const iei =
    attrs.infoEntityIdent != null && String(attrs.infoEntityIdent).trim() !== ""
      ? ` infoEntityIdent="${escapeXml(String(attrs.infoEntityIdent))}"`
      : "";
  const srcRaw = attrs.src;
  const srcTrim =
    typeof srcRaw === "string"
      ? srcRaw.trim()
      : srcRaw != null
        ? String(srcRaw).trim()
        : "";
  const xlink = srcTrim ? ` xlink:href="${escapeXml(srcTrim)}"` : "";
  return `<graphic${id}${iei}${xlink} />`;
}

function serializeNodeToXml(node: JSONContent): string {
  // 1. 处理纯文本与行内样式 (Marks)
  if (node.type === "text") {
    let text = escapeXml(node.text || "");
    if (node.marks) {
      node.marks.forEach((mark) => {
        if (mark.type === "bold")
          text = `<emphasis emphasisType="em01">${text}</emphasis>`;
        else if (mark.type === "italic")
          text = `<emphasis emphasisType="em02">${text}</emphasis>`;
        else if (mark.type === "underline")
          text = `<emphasis emphasisType="em03">${text}</emphasis>`;
        else if (mark.type === "overline")
          text = `<emphasis emphasisType="em04">${text}</emphasis>`;
        else if (mark.type === "strikethrough" || mark.type === "strike")
          text = `<emphasis emphasisType="em05">${text}</emphasis>`;
        else if (
          mark.type === "subscript" ||
          mark.type === "subScript" ||
          mark.type === "s1000dSub"
        )
          text = `<subScript>${text}</subScript>`;
        else if (
          mark.type === "superscript" ||
          mark.type === "superScript" ||
          mark.type === "s1000dSup"
        )
          text = `<superScript>${text}</superScript>`;
        else if (mark.type === "emphasis" || mark.type === "s1000dEmphasis") {
          const type = mark.attrs?.emphasisType || "em01";
          text = `<emphasis emphasisType="${type}">${text}</emphasis>`;
        }
      });
    }
    return text;
  }

  // 🌟 核心防线 1: 如果是块级元素且里面没有任何字，直接熔断抛弃！
  const tagsToFilterIfEmpty = [
    "levelledPara",
    "paragraph",
    "para",
    "randomList",
    "sequentialList",
    "warning",
    "caution",
    "note",
  ];
  if (
    tagsToFilterIfEmpty.includes(node.type || "") &&
    !hasEffectiveContent(node)
  ) {
    return "";
  }

  // 2. 兜底与黑盒数据提取
  if (node.attrs && node.attrs.rawXml) return node.attrs.rawXml;

  if (node.type === "graphic") {
    return serializeGraphicToXml(node.attrs);
  }

  if (node.type === "multimediaObject") {
    return serializeMultimediaObjectToXml(node.attrs);
  }

  // 3. 出版物 / IETMImage：转为 figure + graphic（路径写入 xlink:href）
  if (node.type === "image") {
    const iei = String(node.attrs?.figureId ?? "ICN-UNKNOWN");
    const alt = String(node.attrs?.alt ?? "");
    const graphicXml = serializeGraphicToXml({
      infoEntityIdent: iei,
      src: node.attrs?.src,
    });
    return `<figure id="fig-${escapeXml(iei)}">\n  <title>${escapeXml(alt)}</title>\n  ${graphicXml}\n</figure>`;
  }

  // 4. 标准标签映射
  const tagMap: Record<string, string> = {
    bulletList: "randomList",
    orderedList: "sequentialList",
    paragraph: "para",
    doc: "description",
  };
  const xmlTag = tagMap[node.type || ""] || node.type || "unknown";

  // 5. 过滤不需要导出的内部属性
  let attrsStr = buildAttrsString(node.attrs);

  // 🌟 核心防线 2: 自动补齐 S1000D 表格强制要求的 cols 属性
  if (xmlTag === "tgroup" && !attrsStr.includes("cols=")) {
    let cols = 1;
    try {
      const tbody = node.content?.find(
        (c) => c.type === "tbody" || c.type === "thead",
      );
      const firstRow = tbody?.content?.find((c) => c.type === "row");
      if (firstRow && firstRow.content) {
        cols = firstRow.content.filter((c) => c.type === "entry").length || 1;
      }
    } catch {
      /* ignore malformed table shape */
    }
    attrsStr += ` cols="${cols}"`;
  }

  // ==========================================
  // 🌟 核心防线 3: 强制处理 listItem 的极严苛嵌套包裹规范
  // ==========================================
  let children;

  if (node.type === "listItem") {
    const paras: string[] = [];
    let currentParaContent = "";
    let currentParaAttrs = "";

    const childNodes = node.content || [];
    for (const child of childNodes) {
      // 在 list 内部也要先筛掉空段落，防止产生空的包装
      if (!hasEffectiveContent(child)) continue;

      if (isParaNode(child)) {
        if (currentParaContent) {
          paras.push(`<para${currentParaAttrs}>${currentParaContent}</para>`);
        }
        currentParaAttrs = buildAttrsString(child.attrs);
        currentParaContent = (child.content || [])
          .map(serializeNodeToXml)
          .join("");
      } else if (isListNode(child)) {
        // 遇到嵌套列表，无缝塞进当前 para 内！
        currentParaContent += "\n" + serializeNodeToXml(child);
      } else {
        if (currentParaContent) {
          paras.push(`<para${currentParaAttrs}>${currentParaContent}</para>`);
          currentParaContent = "";
          currentParaAttrs = "";
        }
        paras.push(serializeNodeToXml(child));
      }
    }

    if (currentParaContent) {
      paras.push(`<para${currentParaAttrs}>${currentParaContent}</para>`);
    }

    children = paras.join("\n");
  } else {
    // 非 listItem 的常规处理
    children = serializeChildrenToXml(node);
  }

  // 7. 剥离辅助外壳
  if (node.type === "warningAndCautionLead" || node.type === "noteLead") {
    return children;
  }

  if (node.type === "doc") {
    const kind = getDmContentKind(getDescriptionSchema());
    if (kind === "faultIsolation") {
      return `<content>\n  <faultIsolation>\n${children}\n  </faultIsolation>\n</content>`;
    }
    return `<content>\n  <description>\n${children}\n  </description>\n</content>`;
  }

  if (xmlTag === "tgroup") {
    return `<${xmlTag}${attrsStr}>${buildColspecXml(getTgroupCols(node))}${children}</${xmlTag}>`;
  }

  if (!children && (xmlTag === "title" || xmlTag === "graphic")) {
    return `<${xmlTag}${attrsStr} />`;
  }

  if (!children) {
    return `<${xmlTag}${attrsStr}></${xmlTag}>`;
  }

  return `<${xmlTag}${attrsStr}>${children}</${xmlTag}>`;
}

/**
 * 将当前编辑器内容序列化为完整 S1000D 数据模块 XML 字符串（与工具栏「保存」下载内容一致）。
 */
export function exportEditorToDmXmlString(editor: Editor): string {
  const jsonAST = editor.getJSON();
  const contentXml = serializeNodeToXml(jsonAST);
  const doctypeXml = buildGraphicEntityDoctype(contentXml);

  const identAndStatusXml = useDmMetadataStore.getState().identAndStatusXml;
  const finalIdentXml =
    identAndStatusXml || `<identAndStatusSection>\n  </identAndStatusSection>`;

  return `<?xml version="1.0" encoding="utf-8"?>
${doctypeXml}
<dmodule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
   xmlns:dc="http://www.purl.org/dc/elements/1.1/"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:xlink="http://www.w3.org/1999/xlink"
   xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_4-2/xml_schema_flat/descript.xsd">

   ${finalIdentXml}
   ${contentXml}
</dmodule>`;
}

/**
 * 保存：生成完整 DM XML 并触发浏览器下载（原「导出 XML」逻辑）。
 */
export function save(editor: Editor): void {
  const finalXml = exportEditorToDmXmlString(editor);

  const blob = new Blob([finalXml], { type: "text/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const dateStr = new Date()
    .toISOString()
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace(/T/g, "")
    .slice(0, 14);
  a.download = `DMC-EXPORT-${dateStr}.xml`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
export function internalRef(editor: Editor): void {
  useInternalRefModalStore.getState().openInternalRef(editor);
}
/**
 * 按描述类 schema 将编辑器正文替换为**最小合法**的 S1000D 结构（对应 `<description>` 下块序列）。
 * 用于：DM 中 content/description 为空、`loadDmXml` 失败、或宿主需「空白稿」等场景。
 *
 * @see buildEmptyDescriptionDocJson — 仅生成 JSON、不写入编辑器
 */
export function fillEmptyContentFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const next = buildEmptyDocJsonFromSchema(schema);
  return editor.chain().focus().setContent(next).run();
}

/**
 * 清空编辑器中的正文（对应 DM 的 `<content>/<description>`），并按当前描述类 schema
 * 的最小合法模型重新初始化（与 {@link fillEmptyContentFromSchema} 等价）。
 */
export function clearContent(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  return fillEmptyContentFromSchema(editor, schema);
}
