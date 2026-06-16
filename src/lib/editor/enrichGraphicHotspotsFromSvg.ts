import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";

import type { InsertImagePayload } from "../../types/toolbar";
import { resolveFileUrl } from "../ietm/fileUrl";
import {
  fetchSvgText,
  isSvgImageSource,
  parseSvgHotspotShapeIds,
} from "./parseSvgHotspots";

export type InsertedGraphicRef = {
  graphicPos: number;
  figureId: string;
  src: string;
};

function normalizeFigureId(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "fig-unknown";
  return trimmed.startsWith("fig-") ? trimmed : `fig-${trimmed}`;
}

function collectExistingHotspotIds(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name !== "hotspot") return;
    const id = String(node.attrs.id ?? "").trim();
    if (id) ids.add(id);
  });
  return ids;
}

function allocateHotspotId(
  used: Set<string>,
  figureId: string,
  index: number,
): string {
  const base = normalizeFigureId(figureId);
  let candidate = `${base}-hot-${String(index + 1).padStart(3, "0")}`;
  let n = index + 1;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-hot-${String(n).padStart(3, "0")}`;
  }
  used.add(candidate);
  return candidate;
}

function buildHotspotJson(
  figureId: string,
  shapeIds: string[],
  usedHotspotIds: Set<string>,
): JSONContent[] {
  return shapeIds.map((shapeId, index) => ({
    type: "hotspot",
    attrs: {
      id: allocateHotspotId(usedHotspotIds, figureId, index),
      hotspotTitle: shapeId,
    },
  }));
}

/** 从连续插入的 figure 块收集 `graphic` 位置（sibling 插入）。 */
export function collectGraphicRefsFromFiguresAt(
  doc: PMNode,
  startPos: number,
  images: InsertImagePayload[],
): InsertedGraphicRef[] {
  const refs: InsertedGraphicRef[] = [];
  let pos = startPos;

  for (let i = 0; i < images.length; i++) {
    const figure = doc.nodeAt(pos);
    if (!figure || figure.type.name !== "figure") break;

    const figureId = normalizeFigureId(
      String(figure.attrs.id ?? "") || images[i].figureId,
    );

    let childPos = pos + 1;
    figure.forEach((child) => {
      if (child.type.name === "graphic") {
        refs.push({
          graphicPos: childPos,
          figureId,
          src: images[i].src,
        });
      }
      childPos += child.nodeSize;
    });

    pos += figure.nodeSize;
  }

  return refs;
}

/** figure 内追加 `graphic` 后，收集最后 N 个 graphic（intoBlock 插入）。 */
export function collectGraphicRefsFromFigureAppend(
  doc: PMNode,
  figurePos: number,
  images: InsertImagePayload[],
): InsertedGraphicRef[] {
  const figure = doc.nodeAt(figurePos);
  if (!figure || figure.type.name !== "figure") return [];

  const figureId = normalizeFigureId(String(figure.attrs.id ?? images[0]?.figureId));
  const graphics: { pos: number; src: string }[] = [];
  let childPos = figurePos + 1;

  figure.forEach((child) => {
    if (child.type.name === "graphic") {
      graphics.push({
        pos: childPos,
        src: String(child.attrs.src ?? ""),
      });
    }
    childPos += child.nodeSize;
  });

  const start = Math.max(0, graphics.length - images.length);
  const refs: InsertedGraphicRef[] = [];
  for (let i = start; i < graphics.length; i++) {
    refs.push({
      graphicPos: graphics[i].pos,
      figureId,
      src: images[i - start]?.src ?? graphics[i].src,
    });
  }
  return refs;
}

/**
 * 异步：为刚插入的 SVG `graphic` 解析热点并写入 `hotspot` 子节点。
 * `internalRefId` 应引用生成的 `hotspot@id`；`hotspotTitle` 为 SVG 形状 `id`。
 */
export async function enrichGraphicsWithSvgHotspots(
  editor: Editor,
  refs: InsertedGraphicRef[],
): Promise<void> {
  if (!editor.isEditable || refs.length === 0) return;

  const hotspotType = editor.schema.nodes.hotspot;
  if (!hotspotType) return;

  const sorted = [...refs].sort((a, b) => b.graphicPos - a.graphicPos);
  const usedHotspotIds = collectExistingHotspotIds(editor.state.doc);

  for (const ref of sorted) {
    if (!isSvgImageSource(ref.src)) continue;

    const svgText = await fetchSvgText(resolveFileUrl(ref.src));
    if (!svgText) continue;

    const shapeIds = parseSvgHotspotShapeIds(svgText);
    if (shapeIds.length === 0) continue;

    const graphic = editor.state.doc.nodeAt(ref.graphicPos);
    if (!graphic || graphic.type.name !== "graphic") continue;

    const hotspotJson = buildHotspotJson(ref.figureId, shapeIds, usedHotspotIds);
    const nodes = hotspotJson.map((json) =>
      editor.schema.nodeFromJSON(json),
    );
    const insertPos = ref.graphicPos + graphic.nodeSize - 1;

    editor.view.dispatch(
      editor.state.tr.insert(insertPos, Fragment.fromArray(nodes)),
    );
  }
}

export function scheduleEnrichGraphicsWithSvgHotspots(
  editor: Editor,
  refs: InsertedGraphicRef[],
): void {
  if (refs.length === 0) return;
  void enrichGraphicsWithSvgHotspots(editor, refs).catch(() => {
    /* 解析失败不影响插图 */
  });
}
