import type { Editor } from "@tiptap/core";
import { Fragment, Node as PMNode, type Schema } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { buildEmptyFmftBlockJson } from "../s1000d/buildEmptyFmftBlock";
import { shouldReplenishEmptyFmftAfterDelete } from "../s1000d/schemaFmftReplenish";

/** 支持整块删除的 `fmftElemGroup` 块（图片 / 多媒体）。 */
export const DELETABLE_FMFT_BLOCK_TYPES = new Set(["figure", "multimedia"]);

function isDeletableFmftBlock(typeName: string): boolean {
  return DELETABLE_FMFT_BLOCK_TYPES.has(typeName);
}

function siblingsWithoutIndex(parent: PMNode, index: number): PMNode[] {
  const siblings: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i !== index) siblings.push(parent.child(i));
  }
  return siblings;
}

function buildEmptyParaNode(schema: Schema): PMNode | null {
  const paraType = schema.nodes.para;
  if (!paraType) return null;
  try {
    return paraType.createAndFill() ?? paraType.create(null);
  } catch {
    return null;
  }
}

function buildEmptyFmftBlockNode(schema: Schema, descriptionSchema: ReturnType<typeof getDescriptionSchema>): PMNode | null {
  try {
    return PMNode.fromJSON(schema, buildEmptyFmftBlockJson(descriptionSchema));
  } catch {
    return null;
  }
}

/** 解析 `figure` / `multimedia` 及其文档起始位置。 */
export function resolveFmftBlockAtPos(
  doc: PMNode,
  pos: number,
): { block: PMNode; blockPos: number } | null {
  try {
    const atPos = doc.nodeAt(pos);
    if (atPos && isDeletableFmftBlock(atPos.type.name)) {
      return { block: atPos, blockPos: pos };
    }

    const $pos = doc.resolve(pos);
    const after = $pos.nodeAfter;
    if (after && isDeletableFmftBlock(after.type.name)) {
      return { block: after, blockPos: pos };
    }

    for (let d = $pos.depth; d > 0; d--) {
      if (!isDeletableFmftBlock($pos.node(d).type.name)) continue;
      const blockPos = $pos.before(d);
      const block = doc.nodeAt(blockPos);
      if (block && isDeletableFmftBlock(block.type.name)) {
        return { block, blockPos };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 是否允许删除整块 `figure` / `multimedia`。
 * 删后若 schema 要求至少一个 fmft，会在 {@link deleteFmftBlockAtPos} 中补空块（与清空内容同款占位）。
 */
export function canDeleteFmftBlock(doc: PMNode, blockPos: number): boolean {
  const resolved = resolveFmftBlockAtPos(doc, blockPos);
  if (!resolved) return false;

  try {
    const { blockPos: actualPos } = resolved;
    const $pos = doc.resolve(actualPos);
    const parent = $pos.parent;
    const siblings = siblingsWithoutIndex(parent, $pos.index());
    const descriptionSchema = getDescriptionSchema();

    if (
      shouldReplenishEmptyFmftAfterDelete(
        parent.type.name,
        siblings,
        descriptionSchema,
      ) &&
      buildEmptyFmftBlockNode(parent.type.schema, descriptionSchema)
    ) {
      return true;
    }

    if (parent.type.validContent(Fragment.from(siblings))) {
      return true;
    }

    if (parent.type.name === "doc") {
      const emptyPara = buildEmptyParaNode(parent.type.schema);
      if (!emptyPara) return false;
      return parent.type.validContent(Fragment.from([...siblings, emptyPara]));
    }

    return false;
  } catch {
    return false;
  }
}

/** 删除整块 `figure` / `multimedia`；必要时在原位补空 figure/multimedia。 */
export function deleteFmftBlockAtPos(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canDeleteFmftBlock(doc, blockPos)) return false;

  const resolved = resolveFmftBlockAtPos(doc, blockPos);
  if (!resolved) return false;

  const { block, blockPos: actualPos } = resolved;
  const $pos = doc.resolve(actualPos);
  const parent = $pos.parent;
  const siblings = siblingsWithoutIndex(parent, $pos.index());
  const descriptionSchema = getDescriptionSchema();
  const replenishFmft = shouldReplenishEmptyFmftAfterDelete(
    parent.type.name,
    siblings,
    descriptionSchema,
  );
  const emptyFmftNode = replenishFmft
    ? buildEmptyFmftBlockNode(parent.type.schema, descriptionSchema)
    : null;
  const insertDefaultPara =
    !replenishFmft &&
    parent.type.name === "doc" &&
    !parent.type.validContent(Fragment.from(siblings));

  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      if (!dispatch) return true;

      tr.delete(actualPos, actualPos + block.nodeSize);
      const insertPos = Math.min(tr.mapping.map(actualPos), tr.doc.content.size);

      if (emptyFmftNode) {
        tr.insert(insertPos, emptyFmftNode);
        tr.setSelection(NodeSelection.create(tr.doc, insertPos));
      } else if (insertDefaultPara && !tr.doc.type.validContent(tr.doc.content)) {
        const emptyPara = buildEmptyParaNode(state.schema);
        if (emptyPara) {
          tr.insert(insertPos, emptyPara);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1), 1));
        }
      } else {
        tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos), -1));
      }

      dispatch(tr);
      return true;
    })
    .run();
}
