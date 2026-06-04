import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/** 同 `reqCondGroup` 内 `reqCondNoRef` 的展示序号（从 1 起），仅用于编辑区 UI。 */
export function getReqCondNoRefIndex(doc: PMNode, noRefPos: number): number {
  const node = doc.nodeAt(noRefPos);
  if (!node || node.type.name !== "reqCondNoRef") return 1;

  const $pos = doc.resolve(noRefPos);
  const parent = $pos.parent;
  if (parent.type.name !== "reqCondGroup") return 1;

  const groupPos = $pos.before($pos.depth);
  let index = 0;
  let result = 1;
  parent.forEach((child, offset) => {
    if (child.type.name !== "reqCondNoRef") return;
    index += 1;
    const childPos = groupPos + 1 + offset;
    if (childPos === noRefPos) result = index;
  });
  return result;
}

export function buildReqCondNoRefNode(schema: Editor["schema"]): PMNode {
  const reqCondNoRefType = schema.nodes.reqCondNoRef;
  const reqCondType = schema.nodes.reqCond;
  if (!reqCondNoRefType || !reqCondType) {
    throw new Error("reqCond schema nodes are not registered");
  }
  return reqCondNoRefType.create({}, reqCondType.create({}, null));
}

/** 在 `reqCondGroup` 末尾插入一条 `reqCondNoRef`；若当前为 `noConds` 则替换为第一条条件。 */
export function insertReqCondNoRefAtEnd(
  editor: Editor,
  reqCondGroupPos: number,
): void {
  const group = editor.state.doc.nodeAt(reqCondGroupPos);
  if (!group || group.type.name !== "reqCondGroup") return;

  const newRow = buildReqCondNoRefNode(editor.schema);

  if (group.childCount === 1 && group.firstChild?.type.name === "noConds") {
    const from = reqCondGroupPos + 1;
    const to = from + group.firstChild.nodeSize;
    editor.view.dispatch(editor.state.tr.replaceWith(from, to, newRow));
    return;
  }

  const insertPos = reqCondGroupPos + 1 + group.content.size;
  editor.view.dispatch(editor.state.tr.insert(insertPos, newRow));
}

function countReqCondNoRefInGroup(group: PMNode): number {
  let count = 0;
  group.forEach((child) => {
    if (child.type.name === "reqCondNoRef") count += 1;
  });
  return count;
}

/** 删除一条 `reqCondNoRef`；若为组内最后一条则回退为 `noConds`。 */
export function deleteReqCondNoRefAt(
  editor: Editor,
  noRefPos: number,
): void {
  const current = editor.state.doc.nodeAt(noRefPos);
  if (!current || current.type.name !== "reqCondNoRef") return;

  const $pos = editor.state.doc.resolve(noRefPos);
  let groupPos: number | null = null;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "reqCondGroup") {
      groupPos = $pos.before(d);
      break;
    }
  }
  if (groupPos == null) {
    editor.view.dispatch(
      editor.state.tr.delete(noRefPos, noRefPos + current.nodeSize),
    );
    return;
  }

  const group = editor.state.doc.nodeAt(groupPos);
  if (!group || group.type.name !== "reqCondGroup") return;

  if (countReqCondNoRefInGroup(group) <= 1) {
    const noCondsType = editor.schema.nodes.noConds;
    if (!noCondsType) return;
    const from = groupPos + 1;
    const to = from + group.content.size;
    editor.view.dispatch(
      editor.state.tr.replaceWith(from, to, noCondsType.create()),
    );
    return;
  }

  editor.view.dispatch(
    editor.state.tr.delete(noRefPos, noRefPos + current.nodeSize),
  );
}
