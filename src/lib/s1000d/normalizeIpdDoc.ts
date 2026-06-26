import type { Editor, JSONContent } from "@tiptap/core";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { isIpdDm } from "./dmContentKind";

const IPD_FMFT_TYPES = new Set(["figure", "multimedia"]);

/** 图解类 `doc` 子节点是否需合并/重排物料表。 */
export function ipdDocContentNeedsNormalize(content: JSONContent[]): boolean {
  const groupIndices: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i].type === "catalogSeqNumberGroup") groupIndices.push(i);
  }

  if (groupIndices.length > 1) return true;
  if (content.some((c) => c.type === "catalogSeqNumber")) return true;

  if (groupIndices.length === 1) {
    const catalogIdx = groupIndices[0];
    const group = content[catalogIdx];
    const isEmpty = !(group.content?.length ?? 0);

    for (let i = catalogIdx + 1; i < content.length; i++) {
      const type = content[i].type;
      if (type && IPD_FMFT_TYPES.has(type)) return true;
    }

    if (isEmpty) {
      const fmftBefore = content
        .slice(0, catalogIdx)
        .some((c) => c.type && IPD_FMFT_TYPES.has(c.type));
      const fmftAfter = content
        .slice(catalogIdx + 1)
        .some((c) => c.type && IPD_FMFT_TYPES.has(c.type));
      if (fmftBefore && fmftAfter) return true;
    }
  }

  return false;
}

/**
 * 合并多个 `catalogSeqNumberGroup`、去掉夹在图解块之间的空表，
 * 保证顺序为 `(figure|multimedia)+` → 单个 `catalogSeqNumberGroup`。
 */
export function normalizeIpdDocJson(doc: JSONContent): JSONContent {
  const content = doc.content ?? [];
  if (doc.type !== "doc" || content.length === 0) return doc;
  if (!ipdDocContentNeedsNormalize(content)) return doc;

  const fmftBlocks: JSONContent[] = [];
  const catalogRows: JSONContent[] = [];
  let hadCatalogGroup = false;

  for (const child of content) {
    const type = child.type;
    if (!type) continue;

    if (IPD_FMFT_TYPES.has(type)) {
      fmftBlocks.push(child);
      continue;
    }

    if (type === "catalogSeqNumberGroup") {
      hadCatalogGroup = true;
      for (const row of child.content ?? []) {
        if (row.type === "catalogSeqNumber") catalogRows.push(row);
      }
      continue;
    }

    if (type === "catalogSeqNumber") {
      catalogRows.push(child);
      continue;
    }

    fmftBlocks.push(child);
  }

  const nextContent: JSONContent[] = [...fmftBlocks];
  if (catalogRows.length > 0 || hadCatalogGroup) {
    nextContent.push({ type: "catalogSeqNumberGroup", content: catalogRows });
  }

  return { ...doc, content: nextContent };
}

function editorDocLooksLikeIpd(json: JSONContent): boolean {
  if (isIpdDm(getDescriptionSchema())) return true;
  return (json.content ?? []).some((c) => c.type === "catalogSeqNumberGroup");
}

/** XML/HTML 载入或图解块插入后：合并物料表并重排图解块。 */
export function normalizeIpdDocInEditor(editor: Editor): boolean {
  const json = editor.getJSON();
  if (!editorDocLooksLikeIpd(json)) return false;

  const content = json.content ?? [];
  if (!ipdDocContentNeedsNormalize(content)) return false;

  return editor.commands.setContent(normalizeIpdDocJson(json));
}
