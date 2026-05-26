import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** 节点在数据模块内参与唯一性校验的 ID（`id` 或图片 `figureId`） */
function readUniqueIdForNode(node: ProseMirrorNode): string | null {
  if (node.type.name === "image") {
    const raw = node.attrs.figureId;
    if (raw == null) return null;
    const id = String(raw).trim();
    return id.length > 0 ? id : null;
  }

  if (!("id" in (node.type.spec.attrs ?? {}))) return null;
  const raw = node.attrs.id;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

const CJK_PATTERN = /[\u3400-\u9fff]/;

export type PrimaryIdValidationError =
  | "empty"
  | "chinese"
  | "hash"
  | "duplicate";

const PRIMARY_ID_ERROR_MESSAGES: Record<
  Exclude<PrimaryIdValidationError, "empty">,
  string
> = {
  chinese: "ID 不能包含中文",
  hash: "ID 不能包含 # 号",
  duplicate: "ID 已存在，请输入唯一值",
};

/**
 * 属性面板主 ID 字段校验（确定保存前）：禁止中文、禁止 `#`，并在当前数据模块内唯一。
 */
export function validatePrimaryIdForSave(
  editor: Editor,
  rawValue: string,
  excludePos: number,
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (CJK_PATTERN.test(trimmed)) {
    return PRIMARY_ID_ERROR_MESSAGES.chinese;
  }
  if (trimmed.includes("#")) {
    return PRIMARY_ID_ERROR_MESSAGES.hash;
  }

  let duplicate = false;
  editor.state.doc.descendants((node, pos) => {
    if (duplicate) return false;
    if (pos === excludePos) return;

    const existing = readUniqueIdForNode(node);
    if (existing && existing === trimmed) {
      duplicate = true;
      return false;
    }
  });

  if (duplicate) {
    return PRIMARY_ID_ERROR_MESSAGES.duplicate;
  }

  return null;
}
