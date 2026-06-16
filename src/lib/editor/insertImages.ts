import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import type { FmftInsertIntent } from "../../store/insertPublicationModalStore";
import type { InsertImagePayload } from "../../types/toolbar";
import { resolveFileUrl } from "../ietm/fileUrl";
import { SOURCE_XML_ATTR_KEYS } from "../s1000d/sourceXmlAttrKeys";
import {
  collectGraphicRefsFromFigureAppend,
  collectGraphicRefsFromFiguresAt,
  scheduleEnrichGraphicsWithSvgHotspots,
  type InsertedGraphicRef,
} from "./enrichGraphicHotspotsFromSvg";
import {
  resolveSiblingFigureInsertPos,
  resolveTargetForSiblingFigureInsert,
} from "./siblingFigureInsert";

export type InsertImagesOptions = {
  fmftInsertIntent?: FmftInsertIntent;
};

/** 将插入参数转为 S1000D `graphic`（`figure` 子节点）。 */
export function buildGraphicJsonFromImagePayload(
  img: InsertImagePayload,
): JSONContent {
  const iei = img.figureId?.trim() || "ICN-UNKNOWN";
  const src = resolveFileUrl(img.src?.trim() ?? "");
  return {
    type: "graphic",
    attrs: {
      infoEntityIdent: iei,
      src,
      [SOURCE_XML_ATTR_KEYS]: src
        ? ["infoEntityIdent", "src"]
        : ["infoEntityIdent"],
    },
  };
}

/** 将插入参数转为 S1000D `figure`（`title?` + `graphic`），与导入/XML 结构一致。 */
export function buildFigureJsonFromImagePayload(
  img: InsertImagePayload,
): JSONContent {
  const titleText = img.alt?.trim() ?? "";
  const iei = img.figureId?.trim() || "ICN-UNKNOWN";
  return {
    type: "figure",
    attrs: { id: `fig-${iei}` },
    content: [
      {
        type: "title",
        content: titleText ? [{ type: "text", text: titleText }] : [],
      },
      buildGraphicJsonFromImagePayload(img),
    ],
  };
}

function findEnclosingFigure(
  doc: Editor["state"]["doc"],
  pos: number,
): { figurePos: number; figure: PMNode } | null {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "figure") {
      return { figurePos: $pos.before(d), figure: $pos.node(d) };
    }
  }
  return null;
}

function insertGraphicsIntoFigure(
  editor: Editor,
  figurePos: number,
  figure: PMNode,
  graphics: JSONContent[],
): boolean {
  const insertPos = figurePos + figure.nodeSize - 1;
  return editor.chain().focus().insertContentAt(insertPos, graphics).run();
}

function collectRefsAfterSiblingInsert(
  editor: Editor,
  insertPos: number | null,
  images: InsertImagePayload[],
): InsertedGraphicRef[] {
  const doc = editor.state.doc;
  if (insertPos != null) {
    return collectGraphicRefsFromFiguresAt(doc, insertPos, images);
  }
  const target = resolveTargetForSiblingFigureInsert(editor);
  const resolvedPos = resolveSiblingFigureInsertPos(editor, target);
  if (resolvedPos != null) {
    return collectGraphicRefsFromFiguresAt(doc, resolvedPos, images);
  }
  const from = editor.state.selection.from;
  const $pos = doc.resolve(Math.min(from, doc.content.size));
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "figure") {
      return collectGraphicRefsFromFiguresAt(doc, $pos.before(d), images);
    }
  }
  return collectGraphicRefsFromFiguresAt(doc, 1, images);
}

function insertSiblingFiguresFromToolbar(
  editor: Editor,
  images: InsertImagePayload[],
): { ok: boolean; refs: InsertedGraphicRef[] } {
  const target = resolveTargetForSiblingFigureInsert(editor);
  const insertPos = resolveSiblingFigureInsertPos(editor, target);
  const figures = images.map(buildFigureJsonFromImagePayload);
  const ok =
    insertPos != null
      ? editor.chain().focus().insertContentAt(insertPos, figures).run()
      : editor.chain().focus().insertContent(figures).run();
  if (!ok) return { ok: false, refs: [] };
  return {
    ok: true,
    refs: collectRefsAfterSiblingInsert(editor, insertPos, images),
  };
}

/** 在光标处插入一张或多张 S1000D `figure`（内含 `graphic`；兼容旧称 insertImages）。 */
export function insertImagesIntoEditor(
  editor: Editor,
  images: InsertImagePayload[],
  options?: InsertImagesOptions,
): boolean {
  if (images.length === 0) return false;

  const intent = options?.fmftInsertIntent ?? "sibling";

  if (intent === "sibling") {
    const { ok, refs } = insertSiblingFiguresFromToolbar(editor, images);
    if (ok) scheduleEnrichGraphicsWithSvgHotspots(editor, refs);
    return ok;
  }

  const { selection, doc } = editor.state;
  const graphics = images.map(buildGraphicJsonFromImagePayload);
  let ok = false;
  let refs: InsertedGraphicRef[] = [];

  if (selection instanceof NodeSelection) {
    if (selection.node.type.name === "figure") {
      const figurePos = selection.from;
      ok = insertGraphicsIntoFigure(
        editor,
        figurePos,
        selection.node,
        graphics,
      );
      if (ok) {
        refs = collectGraphicRefsFromFigureAppend(
          editor.state.doc,
          figurePos,
          images,
        );
      }
    } else if (selection.node.type.name === "graphic") {
      const enclosing = findEnclosingFigure(doc, selection.from);
      if (enclosing) {
        ok = insertGraphicsIntoFigure(
          editor,
          enclosing.figurePos,
          enclosing.figure,
          graphics,
        );
        if (ok) {
          refs = collectGraphicRefsFromFigureAppend(
            editor.state.doc,
            enclosing.figurePos,
            images,
          );
        }
      }
    }
  }

  if (!ok) {
    const enclosing = findEnclosingFigure(doc, selection.from);
    if (enclosing) {
      ok = insertGraphicsIntoFigure(
        editor,
        enclosing.figurePos,
        enclosing.figure,
        graphics,
      );
      if (ok) {
        refs = collectGraphicRefsFromFigureAppend(
          editor.state.doc,
          enclosing.figurePos,
          images,
        );
      }
    }
  }

  if (!ok) {
    ok = editor
      .chain()
      .focus()
      .insertContent(images.map(buildFigureJsonFromImagePayload))
      .run();
    if (ok) refs = collectRefsAfterSiblingInsert(editor, null, images);
  }

  if (ok) scheduleEnrichGraphicsWithSvgHotspots(editor, refs);
  return ok;
}
