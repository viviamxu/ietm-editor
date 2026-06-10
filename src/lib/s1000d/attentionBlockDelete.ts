import type { Editor } from "@tiptap/core";
import {
  Fragment,
  Node as PMNode,
  type ResolvedPos,
  type Schema,
} from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

const ATTENTION_BLOCK_TYPES = new Set(["warning", "caution", "note"]);

function isAttentionBlockType(typeName: string): boolean {
  return ATTENTION_BLOCK_TYPES.has(typeName);
}

function countAttentionBlocks(parent: PMNode): number {
  let count = 0;
  parent.forEach((child) => {
    if (isAttentionBlockType(child.type.name)) count++;
  });
  return count;
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

function isUnderReqSafety($pos: ResolvedPos): boolean {
  const safetyDepth = $pos.depth - 1;
  if (safetyDepth < 0) return false;
  if ($pos.node(safetyDepth).type.name !== "safetyRqmts") return false;
  const reqDepth = safetyDepth - 1;
  if (reqDepth < 0) return false;
  return $pos.node(reqDepth).type.name === "reqSafety";
}

/** 解析 `warning` / `caution` / `note` 及其文档起始位置。 */
export function resolveAttentionBlockAtPos(
  doc: PMNode,
  pos: number,
): { block: PMNode; blockPos: number } | null {
  try {
    const atPos = doc.nodeAt(pos);
    if (atPos && isAttentionBlockType(atPos.type.name)) {
      return { block: atPos, blockPos: pos };
    }

    const $pos = doc.resolve(pos);
    const after = $pos.nodeAfter;
    if (after && isAttentionBlockType(after.type.name)) {
      return { block: after, blockPos: pos };
    }

    for (let d = $pos.depth; d > 0; d--) {
      if (!isAttentionBlockType($pos.node(d).type.name)) continue;
      const blockPos = $pos.before(d);
      const block = doc.nodeAt(blockPos);
      if (block && isAttentionBlockType(block.type.name)) {
        return { block, blockPos };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * `safetyRqmts` 内删至 0 时会在删除后回退为 `noSafety`；
 * 描述类 `doc` 根若删后不满足 `(para|attention|fmft)+` 则补空 `para`。
 */
export function canDeleteAttentionBlock(doc: PMNode, blockPos: number): boolean {
  const resolved = resolveAttentionBlockAtPos(doc, blockPos);
  if (!resolved) return false;

  try {
    const { blockPos: actualPos } = resolved;
    const $pos = doc.resolve(actualPos);
    const parent = $pos.parent;
    const siblings = siblingsWithoutIndex(parent, $pos.index());

    if (
      parent.type.name === "safetyRqmts" &&
      countAttentionBlocks(parent) <= 1 &&
      isUnderReqSafety($pos)
    ) {
      return Boolean(parent.type.schema.nodes.noSafety);
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

/** 删除整块 `warning` / `caution` / `note`。 */
export function deleteAttentionBlockAtPos(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canDeleteAttentionBlock(doc, blockPos)) return false;

  const resolved = resolveAttentionBlockAtPos(doc, blockPos);
  if (!resolved) return false;

  const { block, blockPos: actualPos } = resolved;
  const $pos = doc.resolve(actualPos);
  const parent = $pos.parent;
  const siblings = siblingsWithoutIndex(parent, $pos.index());

  const revertSafetyToNoSafety =
    parent.type.name === "safetyRqmts" &&
    countAttentionBlocks(parent) <= 1 &&
    isUnderReqSafety($pos);
  const safetyRqmtsPos = revertSafetyToNoSafety ? $pos.before($pos.depth) : null;

  const insertDefaultPara =
    parent.type.name === "doc" &&
    !parent.type.validContent(Fragment.from(siblings));

  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      if (!dispatch) return true;

      tr.delete(actualPos, actualPos + block.nodeSize);

      if (safetyRqmtsPos != null) {
        const mapped = tr.mapping.map(safetyRqmtsPos);
        const safetyRqmts = tr.doc.nodeAt(mapped);
        const noSafetyType = state.schema.nodes.noSafety;
        if (
          safetyRqmts?.type.name === "safetyRqmts" &&
          noSafetyType &&
          countAttentionBlocks(safetyRqmts) === 0
        ) {
          tr.replaceWith(mapped, mapped + safetyRqmts.nodeSize, noSafetyType.create());
        }
      }

      if (insertDefaultPara && !tr.doc.type.validContent(tr.doc.content)) {
        const emptyPara = buildEmptyParaNode(state.schema);
        if (emptyPara) {
          const insertPos = Math.min(
            tr.mapping.map(actualPos),
            tr.doc.content.size,
          );
          tr.insert(insertPos, emptyPara);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1), 1));
        }
      }

      dispatch(tr);
      return true;
    })
    .run();
}
