import type { Editor, JSONContent } from "@tiptap/core";

import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import type { DescriptionSchema } from "../../types/descriptionSchema";

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
