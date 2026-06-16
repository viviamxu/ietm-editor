import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import { useToolbarConfigStore } from "../../store/toolbarConfigStore";
import type {
  FmftInsertIntent,
  ToolbarItemContext,
} from "../../types/toolbar";
import { removeEmptyGraphicsFromFigure } from "./figureGraphic";

/** `multimedia` 是否已有可展示的 `multimediaObject`。 */
export function multimediaHasDisplayableObject(multimedia: PMNode): boolean {
  if (multimedia.type.name !== "multimedia") return false;
  let found = false;
  multimedia.forEach((child) => {
    if (child.type.name !== "multimediaObject") return;
    const ident = String(child.attrs.infoEntityIdent ?? "").trim();
    const mediaSrc = String(child.attrs.mediaSrc ?? "").trim();
    const sceneSrc = String(child.attrs.sceneSrc ?? "").trim();
    if (ident || mediaSrc || sceneSrc) found = true;
  });
  return found;
}

/** 删除 `multimedia` 内无内容的空壳 `multimediaObject`。 */
export function removeEmptyObjectsFromMultimedia(
  editor: Editor,
  multimediaPos: number,
): void {
  const multimedia = editor.state.doc.nodeAt(multimediaPos);
  if (!multimedia || multimedia.type.name !== "multimedia") return;

  const toDelete: { from: number; to: number }[] = [];
  let offset = multimediaPos + 1;
  multimedia.forEach((child) => {
    const childPos = offset;
    if (child.type.name === "multimediaObject") {
      const ident = String(child.attrs.infoEntityIdent ?? "").trim();
      const mediaSrc = String(child.attrs.mediaSrc ?? "").trim();
      const sceneSrc = String(child.attrs.sceneSrc ?? "").trim();
      if (!ident && !mediaSrc && !sceneSrc) {
        toDelete.push({ from: childPos, to: childPos + child.nodeSize });
      }
    }
    offset += child.nodeSize;
  });

  if (toDelete.length === 0) return;

  const tr = editor.state.tr;
  for (let i = toDelete.length - 1; i >= 0; i--) {
    tr.delete(toDelete[i].from, toDelete[i].to);
  }
  editor.view.dispatch(tr);
}

export function buildFmftToolbarContext(
  editor: Editor,
  options: {
    fmftInsertIntent?: FmftInsertIntent;
    fmftBlockPos?: number;
    fmftBlockType?: "figure" | "multimedia";
  } = {},
): ToolbarItemContext {
  return {
    editor,
    editable: editor.isEditable,
    activeTabKey: "insert",
    formatBarLocked: !editor.isEditable,
    fmftInsertIntent: options.fmftInsertIntent ?? "sibling",
    fmftBlockPos: options.fmftBlockPos,
    fmftBlockType: options.fmftBlockType,
  };
}

/** 若宿主配置了 `onInsertImageClick` 则委托宿主，返回 `true`。 */
export function tryDelegateInsertImage(
  editor: Editor,
  options: {
    fmftInsertIntent?: FmftInsertIntent;
    fmftBlockPos?: number;
    fmftBlockType?: "figure" | "multimedia";
  } = {},
): boolean {
  const onInsertImageClick =
    useToolbarConfigStore.getState().onInsertImageClick;
  if (!onInsertImageClick) return false;
  onInsertImageClick(buildFmftToolbarContext(editor, options));
  return true;
}

/** 若宿主配置了 `onInsertFilmClick` 则委托宿主，返回 `true`。 */
export function tryDelegateInsertFilm(
  editor: Editor,
  options: {
    fmftInsertIntent?: FmftInsertIntent;
    fmftBlockPos?: number;
    fmftBlockType?: "figure" | "multimedia";
  } = {},
): boolean {
  const onInsertFilmClick = useToolbarConfigStore.getState().onInsertFilmClick;
  if (!onInsertFilmClick) return false;
  onInsertFilmClick(buildFmftToolbarContext(editor, options));
  return true;
}

/**
 * 按 schema 规则打开「插入图片」或「插入多媒体」弹框，并选中目标 fmft 块以便回填。
 * 若宿主已配置 `onInsertImageClick` / `onInsertFilmClick` 则委托宿主。
 */
export function openPublicationModalForFmftBlock(
  editor: Editor,
  blockPos: number,
  blockType: "figure" | "multimedia",
): void {
  if (!editor.isEditable) return;

  if (blockType === "figure") {
    removeEmptyGraphicsFromFigure(editor, blockPos);
  } else {
    removeEmptyObjectsFromMultimedia(editor, blockPos);
  }

  editor.chain().focus().setNodeSelection(blockPos).run();

  const delegateOptions = {
    fmftInsertIntent: "intoBlock" as const,
    fmftBlockPos: blockPos,
    fmftBlockType: blockType,
  };

  if (blockType === "figure") {
    if (tryDelegateInsertImage(editor, delegateOptions)) return;
  } else if (tryDelegateInsertFilm(editor, delegateOptions)) {
    return;
  }

  const mode = blockType === "multimedia" ? "multimedia" : "image";
  useInsertPublicationModalStore
    .getState()
    .openInsertPublication(editor, mode, { fmftInsertIntent: "intoBlock" });
}
