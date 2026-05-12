import type { Editor, JSONContent } from "@tiptap/core";

import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
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
  return editor.chain().focus().insertContent(json).run();
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
// --- 以下代码添加到 descriptionSchemaInsert.ts 的最底部 ---

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
 * 递归遍历 Tiptap JSON AST，将其还原为 S1000D XML 字符串
 */
function serializeNodeToXml(node: JSONContent): string {
  // 1. 处理纯文本与行内样式 (Marks)
  if (node.type === "text") {
    let text = escapeXml(node.text || "");
    if (node.marks) {
      node.marks.forEach((mark) => {
        // 将富文本样式映射回 S1000D 标签
        if (mark.type === "bold") {
          text = `<emphasis emphasisType="em01">${text}</emphasis>`;
        } else if (mark.type === "italic") {
          text = `<emphasis emphasisType="em02">${text}</emphasis>`;
        } else if (mark.type === "underline") {
          text = `<emphasis emphasisType="em03">${text}</emphasis>`;
        } else if (mark.type === "subscript" || mark.type === "subScript") {
          text = `<subScript>${text}</subScript>`;
        } else if (mark.type === "superscript" || mark.type === "superScript") {
          text = `<superScript>${text}</superScript>`;
        } else if (mark.type === "emphasis") {
          const type = mark.attrs?.emphasisType || "em01";
          text = `<emphasis emphasisType="${type}">${text}</emphasis>`;
        }
      });
    }
    return text;
  }

  // 2. 兜底与黑盒数据提取（例如复杂的 dmRef 如果存了 rawXml 属性，直接还原）
  if (node.attrs && node.attrs.rawXml) {
    return node.attrs.rawXml;
  }

  // 3. 处理图片转换 (映射为 S1000D 的 figure/graphic)
  if (node.type === "image") {
    const id = node.attrs?.figureId || "ICN-UNKNOWN";
    const alt = node.attrs?.alt || "";
    return `<figure id="fig-${id}">\n  <title>${escapeXml(alt)}</title>\n  <graphic infoEntityIdent="${escapeXml(id)}" />\n</figure>`;
  }

  // 4. 标准标签映射映射表 (Tiptap 标签名 -> S1000D XML 标签名)
  const tagMap: Record<string, string> = {
    bulletList: "randomList",
    orderedList: "sequentialList",
    paragraph: "para",
    doc: "description", // Tiptap 的根节点对应 description
  };

  const xmlTag = tagMap[node.type || ""] || node.type || "unknown";

  // 5. 提取并组装属性
  let attrsStr = "";
  if (node.attrs) {
    for (const [key, value] of Object.entries(node.attrs)) {
      // 过滤掉内部状态属性，如 class 或 rawXml
      if (
        value !== null &&
        value !== undefined &&
        key !== "rawXml" &&
        key !== "class"
      ) {
        attrsStr += ` ${key}="${escapeXml(String(value))}"`;
      }
    }
  }

  // 6. 递归处理子节点
  const children = (node.content || []).map(serializeNodeToXml).join("");

  // 7. 处理根节点包装
  if (node.type === "doc") {
    return `<content>\n  <description>\n${children}\n  </description>\n</content>`;
  }

  // 8. 返回组装好的 XML 标签
  if (!children) {
    // 空标签处理，防止自闭合标签导致某些解析器报错，统一使用双标签
    return `<${xmlTag}${attrsStr}></${xmlTag}>`;
  }

  return `<${xmlTag}${attrsStr}>${children}</${xmlTag}>`;
}

/**
 * 导出编辑器内容为 S1000D XML 并触发浏览器下载
 */
export function print(editor: Editor): void {
  // 1. 获取编辑器的 AST
  const jsonAST = editor.getJSON();

  const contentXml = serializeNodeToXml(jsonAST);
  // 2. 从 Store 中提取一开始暂存的 identAndStatusSection
  const identAndStatusXml = useDmMetadataStore.getState().identAndStatusXml;
  const finalIdentXml =
    identAndStatusXml ||
    `<identAndStatusSection>\n    \n  </identAndStatusSection>`;
  // 3. 组装一个合法的 S1000D 外壳 (此处为最小可用外壳，真实场景需结合原 XML 头部合并)
  const finalXml = `<?xml version="1.0" encoding="utf-8"?>
    <dmodule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_4-2/xml_schema_flat/descript.xsd">
      ${finalIdentXml}
      ${contentXml}
    </dmodule>`;

  // 4. 利用 Blob 创建内存文件，并模拟点击下载
  const blob = new Blob([finalXml], { type: "text/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  // 格式化当前时间作为默认文件名
  const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  a.download = `DMC-EXPORT-${dateStr}.xml`;

  document.body.appendChild(a);
  a.click();

  // 清理内存
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
