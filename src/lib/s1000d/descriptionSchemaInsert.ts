import type { Editor, JSONContent } from "@tiptap/core";

import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import { useInternalRefModalStore } from "../../store/internalRefModalStore";
import type { DescriptionSchema } from "../../types/descriptionSchema";
import { useDmMetadataStore } from "../../store/dmMetadataStore";

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

export function insertLevelledParaFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  const node = buildInsertLevelledParaJson(schema);
  if (!node) return false;
  return editor.chain().focus().insertContent(node).run();
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

/** randomList；在 warning/caution 正文中插入 attentionRandomList（schema 未单独建模时仍允许）。 */
export function insertRandomOrAttentionListFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (isInsideNodeType(editor, "warningAndCautionPara")) {
    return editor
      .chain()
      .focus()
      .insertContent({
        type: "attentionRandomList",
        content: [
          {
            type: "attentionRandomListItem",
            content: [{ type: "attentionListItemPara", content: [] }],
          },
        ],
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
  void editor;
  void schema;
  useInsertPublicationModalStore.getState().openInsertPublication(editor);
}

export function insertImageFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): void {
  void schema;
  useInsertPublicationModalStore.getState().openInsertPublication(editor);
}

/** 满足 `description.content` 中 `attentionElemGroup` 分支的最小块（warning / caution / note）。 */
function buildMinimalAttentionElemChild(
  schema: DescriptionSchema,
): JSONContent | null {
  if (requireSchemaNode(schema, "warning")) {
    return {
      type: "warning",
      content: [{ type: "warningAndCautionPara", content: [] }],
    };
  }
  if (requireSchemaNode(schema, "caution")) {
    return {
      type: "caution",
      content: [{ type: "warningAndCautionPara", content: [] }],
    };
  }
  if (requireSchemaNode(schema, "note")) {
    return {
      type: "note",
      content: [{ type: "notePara", content: [] }],
    };
  }
  return null;
}

/** 满足 `fmftElemGroup` 的最小块：优先 `figure`（含一个 `graphic`），否则最小 `table`。 */
function buildMinimalFmftElemChild(
  schema: DescriptionSchema,
): JSONContent | null {
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

  if (node.type !== "levelledPara") {
    return (node.content || []).map(serializeNodeToXml).join("");
  }

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

  // 3. 处理图片转换
  if (node.type === "image") {
    const id = node.attrs?.figureId || "ICN-UNKNOWN";
    const alt = node.attrs?.alt || "";
    return `<figure id="fig-${id}">\n  <title>${escapeXml(alt)}</title>\n  <graphic infoEntityIdent="${escapeXml(id)}" />\n</figure>`;
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
  if (node.type === "warningAndCautionLead") {
    return children;
  }

  if (node.type === "doc") {
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
  const next = buildEmptyDescriptionDocJson(schema);
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
