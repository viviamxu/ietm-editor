import type { Editor, JSONContent } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import type { DescriptionSchema } from "../../types/descriptionSchema";
import type { CrewContentMode } from "./crewInsert";
import {
  buildMinimalCrewRefCardJson,
  buildMinimalDescrCrewJson,
} from "./crewInsert";

export type { CrewContentMode } from "./crewInsert";

const CACHE_ATTR: Record<CrewContentMode, "cachedCrewRefCardJson" | "cachedDescrCrewJson"> = {
  crewRefCard: "cachedCrewRefCardJson",
  descrCrew: "cachedDescrCrewJson",
};

export function resolveCrewContentMode(doc: PMNode): CrewContentMode {
  return doc.firstChild?.type.name === "descrCrew" ? "descrCrew" : "crewRefCard";
}

function serializeCrewBranch(node: PMNode): string {
  return JSON.stringify(node.toJSON());
}

function parseCachedCrewBranchJson(
  cached: string | null | undefined,
): JSONContent | null {
  if (cached == null || String(cached).trim() === "") return null;
  try {
    const parsed = JSON.parse(cached) as JSONContent;
    if (typeof parsed?.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function defaultCrewBranchJson(
  mode: CrewContentMode,
  schema: DescriptionSchema,
): JSONContent {
  return mode === "descrCrew"
    ? buildMinimalDescrCrewJson(schema)
    : buildMinimalCrewRefCardJson();
}

function selectionInCrewRootTitle(
  doc: PMNode,
  rootPos: number,
): TextSelection | null {
  const node = doc.nodeAt(rootPos);
  if (!node) return null;

  let offset = rootPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "title") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    if (child.type.name === "levelledPara") {
      let lpOffset = offset + 1;
      for (let j = 0; j < child.childCount; j++) {
        const grandchild = child.child(j);
        if (grandchild.type.name === "title") {
          const caret = Math.min(lpOffset + 1, doc.content.size);
          if (caret < 0 || caret > doc.content.size) return null;
          return TextSelection.create(doc, caret);
        }
        lpOffset += grandchild.nodeSize;
      }
      const caret = Math.min(offset + 2, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    if (child.type.name === "para") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }

  const fallback = Math.min(rootPos + 2, doc.content.size);
  if (fallback < 0 || fallback > doc.content.size) return null;
  return TextSelection.create(doc, fallback);
}

/**
 * 切换操作类 `crewRefCard` / `descrCrew` 模式。
 * 切换前缓存当前模式内容；目标模式优先恢复缓存，否则生成与「清空内容」一致的最小稿。
 */
export function replaceCrewContentMode(
  editor: Editor,
  target: CrewContentMode,
  schema: DescriptionSchema,
): boolean {
  const doc = editor.state.doc;
  const current = doc.firstChild;
  if (!current) return false;

  const currentKind = resolveCrewContentMode(doc);
  if (currentKind === target) return true;

  const incomingCacheKey = CACHE_ATTR[target];
  const outgoingCacheKey = CACHE_ATTR[currentKind];

  const currentAttrs = { ...current.attrs } as Record<string, string | null>;
  const savedOutgoing = serializeCrewBranch(current);

  const cachedIncoming = parseCachedCrewBranchJson(
    currentAttrs[incomingCacheKey],
  );
  const branchJson =
    cachedIncoming ?? defaultCrewBranchJson(target, schema);

  const nextAttrs = {
    ...(branchJson.attrs ?? {}),
    [outgoingCacheKey]: savedOutgoing,
  } as Record<string, unknown>;

  let newChild: PMNode;
  try {
    newChild = editor.schema.nodeFromJSON({
      ...branchJson,
      attrs: nextAttrs,
    });
  } catch {
    return false;
  }

  const from = 0;
  const to = doc.content.size;
  let tr = editor.state.tr.replaceWith(from, to, newChild);
  const sel = selectionInCrewRootTitle(tr.doc, 0);
  if (sel) tr = tr.setSelection(sel);
  editor.view.dispatch(tr);
  return true;
}

/** 操作类 DM 是否处于 `crewRefCard` 模式（可插入 crewDrill 等）。 */
export function isCrewRefCardMode(doc: PMNode): boolean {
  return resolveCrewContentMode(doc) === "crewRefCard";
}
