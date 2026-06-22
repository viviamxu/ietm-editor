import type { Editor, JSONContent } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

import { resolveFileUrl } from "../ietm/fileUrl";
import {
  nodeTypeAllowedInContentRule,
  resolveSchemaContentRuleForEditorParent,
} from "../s1000d/schemaContentRuleValidate";
import { SOURCE_XML_ATTR_KEYS } from "../s1000d/sourceXmlAttrKeys";
import type { DescriptionSchema } from "../../types/descriptionSchema";
import type { InsertImagePayload } from "../../types/toolbar";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import { tryDelegateInsertSymbol } from "./symbolPublicationPick";

const PLACEHOLDER_PAYLOAD: InsertImagePayload = {
  src: "",
  figureId: "ICN-UNKNOWN",
};

const INLINE_CONTAINER_TO_SCHEMA_KEY: Record<string, string> = {
  warningAndCautionLead: "warningAndCautionPara",
  noteLead: "notePara",
  paragraph: "para",
  para: "para",
  attentionListItemPara: "attentionListItemPara",
};

const ATTENTION_BLOCK_TYPES = new Set(["warning", "caution", "note"]);

function contentRuleMentions(rule: string | undefined, token: string): boolean {
  if (!rule?.trim()) return false;
  return rule.split(/[\s|()]+/).includes(token);
}

function schemaAllowsSymbolInContainer(
  containerTypeName: string,
  schema: DescriptionSchema,
): boolean {
  const rule = resolveSchemaContentRuleForEditorParent(containerTypeName, schema);
  return nodeTypeAllowedInContentRule("symbol", rule, schema);
}

function buildSymbolAttrs(img: InsertImagePayload): JSONContent["attrs"] {
  const iei = img.figureId?.trim() || "ICN-UNKNOWN";
  const src = resolveFileUrl(img.src?.trim() ?? "");
  return {
    infoEntityIdent: iei,
    id: null,
    src,
    [SOURCE_XML_ATTR_KEYS]: src
      ? ["infoEntityIdent", "src"]
      : ["infoEntityIdent"],
  };
}

/** 行内 `symbol`（para / lead 等）。 */
export function buildInlineSymbolJson(img: InsertImagePayload): JSONContent {
  return {
    type: "symbol",
    attrs: buildSymbolAttrs(img),
  };
}

/** 块级 `attentionSymbol`（`warning` / `caution` / `note` 直接子节点，导出为 `<symbol/>`）。 */
export function buildAttentionSymbolJson(img: InsertImagePayload): JSONContent {
  return {
    type: "attentionSymbol",
    attrs: buildSymbolAttrs(img),
  };
}

function findEnclosingAttentionBlock(
  $from: ResolvedPos,
): { type: "warning" | "caution" | "note"; depth: number } | null {
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (ATTENTION_BLOCK_TYPES.has(name)) {
      return { type: name as "warning" | "caution" | "note", depth: d };
    }
  }
  return null;
}

function inlineContainerAtCursor(
  $from: ResolvedPos,
): { typeName: string; depth: number } | null {
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const content = node.type.spec.content ?? "";
    if (typeof content === "string" && content.includes("inline")) {
      return { typeName: node.type.name, depth: d };
    }
  }
  return null;
}

export function canInsertInlineSymbolFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!editor.state.schema.nodes.symbol) return false;
  const inline = inlineContainerAtCursor(editor.state.selection.$from);
  if (!inline) return false;
  const schemaKey =
    INLINE_CONTAINER_TO_SCHEMA_KEY[inline.typeName] ?? inline.typeName;
  if (!schemaAllowsSymbolInContainer(schemaKey, schema)) return false;
  return editor.can().insertContent(buildInlineSymbolJson(PLACEHOLDER_PAYLOAD));
}

export function canInsertAttentionSymbolFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  if (!editor.state.schema.nodes.attentionSymbol) return false;
  const block = findEnclosingAttentionBlock(editor.state.selection.$from);
  if (!block) return false;
  if (!contentRuleMentions(schema[block.type]?.content, "symbol")) return false;
  const blockNode = editor.state.selection.$from.node(block.depth);
  let hasPara = false;
  blockNode.forEach((child) => {
    if (
      child.type.name === "warningAndCautionPara" ||
      child.type.name === "notePara"
    ) {
      hasPara = true;
    }
  });
  if (!hasPara) return false;
  return true;
}

export function canInsertSymbolFromSchema(
  editor: Editor,
  schema: DescriptionSchema,
): boolean {
  return (
    canInsertInlineSymbolFromSchema(editor, schema) ||
    canInsertAttentionSymbolFromSchema(editor, schema)
  );
}

function insertInlineSymbol(
  editor: Editor,
  payload: InsertImagePayload,
): boolean {
  const json = buildInlineSymbolJson(payload);
  if (!editor.can().insertContent(json)) return false;
  return editor.chain().focus().insertContent(json).run();
}

function findAttentionSymbolChildIndex(blockNode: {
  forEach: (
    f: (
      node: { type: { name: string }; nodeSize: number },
      offset: number,
      index: number,
    ) => void,
  ) => void;
}): number {
  let found = -1;
  blockNode.forEach((_child, _offset, index) => {
    if (_child.type.name === "attentionSymbol") found = index;
  });
  return found;
}

function insertOrReplaceAttentionSymbolAtBlockPos(
  editor: Editor,
  blockPos: number,
  payload: InsertImagePayload,
): boolean {
  const blockNode = editor.state.doc.nodeAt(blockPos);
  if (!blockNode || !ATTENTION_BLOCK_TYPES.has(blockNode.type.name)) {
    return false;
  }

  const symbolJson = buildAttentionSymbolJson(payload);
  const existingIndex = findAttentionSymbolChildIndex(blockNode);

  if (existingIndex >= 0) {
    let pos = blockPos + 1;
    let targetPos = -1;
    blockNode.forEach((child, _offset, index) => {
      if (index === existingIndex) targetPos = pos;
      pos += child.nodeSize;
    });
    if (targetPos < 0) return false;
    const tr = editor.state.tr.setNodeMarkup(
      targetPos,
      undefined,
      symbolJson.attrs ?? {},
    );
    editor.view.dispatch(tr);
    editor.commands.focus();
    return true;
  }

  const insertPos = blockPos + 1;
  if (!editor.can().insertContentAt(insertPos, symbolJson)) return false;
  return editor.chain().focus().insertContentAt(insertPos, symbolJson).run();
}

function insertOrReplaceAttentionSymbol(
  editor: Editor,
  payload: InsertImagePayload,
): boolean {
  const block = findEnclosingAttentionBlock(editor.state.selection.$from);
  if (!block) return false;
  return insertOrReplaceAttentionSymbolAtBlockPos(
    editor,
    editor.state.selection.$from.before(block.depth),
    payload,
  );
}

/** 从 warning/caution/note 默认图标打开「插入符号」弹框。 */
export function openInsertSymbolModalForAttentionBlock(
  editor: Editor,
  blockPos: number,
): void {
  if (!editor.isEditable) return;
  const blockNode = editor.state.doc.nodeAt(blockPos);
  if (!blockNode || !ATTENTION_BLOCK_TYPES.has(blockNode.type.name)) return;

  editor.chain().focus().setNodeSelection(blockPos).run();
  const blockType = blockNode.type.name as "warning" | "caution" | "note";
  if (
    tryDelegateInsertSymbol(editor, {
      attentionBlockPos: blockPos,
      attentionBlockType: blockType,
    })
  ) {
    return;
  }
  useInsertPublicationModalStore.getState().openInsertPublication(editor, "symbol", {
    attentionBlockPos: blockPos,
  });
}

/** 解析子节点（如 `attentionSymbol`）所属的 warning/caution/note 块位置。 */
export function findAttentionBlockPosContaining(
  editor: Editor,
  childPos: number,
): number | null {
  const $pos = editor.state.doc.resolve(childPos);
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (ATTENTION_BLOCK_TYPES.has(name)) {
      return $pos.before(d);
    }
  }
  return null;
}

export type InsertSymbolOptions = {
  schema?: DescriptionSchema;
  /** 指定 warning/caution/note 块位置，写入块级 `attentionSymbol` */
  attentionBlockPos?: number;
};

/** 在光标处插入 symbol（自动选择行内或 attention 块级路径）。 */
export function insertSymbolIntoEditor(
  editor: Editor,
  payload: InsertImagePayload,
  options?: InsertSymbolOptions,
): boolean {
  if (options?.attentionBlockPos != null) {
    return insertOrReplaceAttentionSymbolAtBlockPos(
      editor,
      options.attentionBlockPos,
      payload,
    );
  }

  const schema = options?.schema;
  if (schema && canInsertInlineSymbolFromSchema(editor, schema)) {
    return insertInlineSymbol(editor, payload);
  }
  if (
    (!schema || canInsertAttentionSymbolFromSchema(editor, schema)) &&
    insertOrReplaceAttentionSymbol(editor, payload)
  ) {
    return true;
  }
  if (!schema) {
    if (insertInlineSymbol(editor, payload)) return true;
    return insertOrReplaceAttentionSymbol(editor, payload);
  }
  return false;
}
