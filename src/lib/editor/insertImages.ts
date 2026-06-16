import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import type { FmftInsertIntent } from "../../store/insertPublicationModalStore";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import type { InsertImagePayload } from "../../types/toolbar";
import { resolveFileUrl } from "../ietm/fileUrl";
import { isIpdDm } from "../s1000d/dmContentKind";
import { SOURCE_XML_ATTR_KEYS } from "../s1000d/sourceXmlAttrKeys";
import {
  resolveIpdSiblingInsertPos,
  resolveIpdTargetFmftBlockForSiblingInsert,
} from "./ipdSiblingFmftInsert";

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

function insertSiblingFiguresForIpd(
  editor: Editor,
  images: InsertImagePayload[],
): boolean {
  const target = resolveIpdTargetFmftBlockForSiblingInsert(editor);
  const insertPos = resolveIpdSiblingInsertPos(editor, target);
  const figures = images.map(buildFigureJsonFromImagePayload);
  return editor.chain().focus().insertContentAt(insertPos, figures).run();
}

/** 在光标处插入一张或多张 S1000D `figure`（内含 `graphic`；兼容旧称 insertImages）。 */
export function insertImagesIntoEditor(
  editor: Editor,
  images: InsertImagePayload[],
  options?: InsertImagesOptions,
): boolean {
  if (images.length === 0) return false;

  const intent = options?.fmftInsertIntent ?? "sibling";
  const schema = getDescriptionSchema();

  if (isIpdDm(schema) && intent === "sibling") {
    return insertSiblingFiguresForIpd(editor, images);
  }

  const { selection, doc } = editor.state;
  const graphics = images.map(buildGraphicJsonFromImagePayload);

  if (selection instanceof NodeSelection) {
    const selected = selection.node;

    if (selected.type.name === "figure") {
      return insertGraphicsIntoFigure(
        editor,
        selection.from,
        selected,
        graphics,
      );
    }

    if (selected.type.name === "graphic") {
      const enclosing = findEnclosingFigure(doc, selection.from);
      if (enclosing) {
        return insertGraphicsIntoFigure(
          editor,
          enclosing.figurePos,
          enclosing.figure,
          graphics,
        );
      }
    }

    const insertPos = selection.from + selected.nodeSize;
    const figures = images.map(buildFigureJsonFromImagePayload);
    return editor.chain().focus().insertContentAt(insertPos, figures).run();
  }

  const enclosing = findEnclosingFigure(doc, selection.from);
  if (enclosing) {
    return insertGraphicsIntoFigure(
      editor,
      enclosing.figurePos,
      enclosing.figure,
      graphics,
    );
  }

  const figures = images.map(buildFigureJsonFromImagePayload);
  return editor.chain().focus().insertContent(figures).run();
}
