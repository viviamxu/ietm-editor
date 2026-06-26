import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import type { FmftInsertIntent } from "../../store/insertPublicationModalStore";
import { resolveFileUrl } from "../ietm/fileUrl";
import { resolveMultimediaTypeForXml } from "../s1000d/multimediaType";
import {
  resolveHostBlockPosFromSelection,
  ensureParaAfterHostInsert,
} from "./insertParaAfterFmftBlock";
import { insertFmftNodesIntoEditor } from "./resolveProcedureFmftInsertPos";
import { normalizeIpdDocInEditor } from "../s1000d/normalizeIpdDoc";
import { insertSiblingFmftNodesFromToolbar } from "./siblingFigureInsert";

export type InsertMultimediaOptions = {
  fmftInsertIntent?: FmftInsertIntent;
};

export type InsertMultimediaParameterPayload = {
  id: string;
  parameterIdent: string;
  parameterValue: string;
  parameterName: string;
};

export type InsertMultimediaPayload = {
  /** 映射为 `multimediaObject@infoEntityIdent` */
  infoEntityIdent: string;
  /** 可选标题，写入 `multimedia > title` */
  title?: string;
  /**
   * ICN 业务类型：`"cc3d"` 三维 | `"webgl"` WebGL | `"math"` 公式 | `null` 其它。
   * 对应后端 `dataType`，存储于节点 attr，**不写入 S1000D XML**。
   */
  dataType?: string | null;
  /**
   * 三维场景包 URL（cc3d 时对应 `cc-3d-scene` 的 `src`）。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  sceneSrc?: string;
  /**
   * 2D 预览图 URL（视频封面 / cc3d 的 `img-src`）。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  previewImgSrc?: string;
  /**
   * cc3d 场景配置文件路径。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  cnfPath?: string | null;
  /** 文件后缀（如 `mp4`），对应后端 `fileType`。 */
  fileType?: string | null;
  /**
   * 主媒体 URL（视频 mp4 等）。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  mediaSrc?: string;
  /**
   * S1000D `multimediaObject@multimediaType`（如 `video`、`3D`）。
   * 未传时由 {@link resolveMultimediaTypeForXml} 根据 fileType/dataType 推断。
   */
  multimediaType?: string | null;
  /**
   * WebGL 页面/资源 URL。编辑器内存 + 导出 DM XML 时写入 `multimediaObject@xlink:href`。
   */
  webglUrl?: string | null;
  /**
   * WebGL 命令模板 JSON 字符串。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  webglCommandTemplate?: string | null;
  /**
   * WebGL 命令实例 JSON 字符串。
   * 存储于节点 attr，**不写入 S1000D XML**。
   */
  webglCommand?: string | null;
  /**
   * cc3d 场景参数，写入 `multimediaObject` 子节点 `<parameter>`（导出至 S1000D XML）。
   * 宿主可在确认插入 cc3d 且 `cnfPath` 有值时，从 scene.json 的
   * `timeline` / `children` / `clips` 自动生成。
   */
  parameters?: InsertMultimediaParameterPayload[];
};

function buildParameterContentJson(
  parameters: InsertMultimediaParameterPayload[] | undefined,
): JSONContent[] {
  if (!parameters?.length) return [];
  const nodes: JSONContent[] = [];
  for (const p of parameters) {
    const id = p.id.trim();
    const parameterIdent = p.parameterIdent.trim();
    const parameterValue = p.parameterValue.trim();
    const parameterName = p.parameterName.trim();
    if (!id && !parameterIdent && !parameterValue && !parameterName) continue;
    nodes.push({
      type: "parameter",
      attrs: {
        id: id || null,
        parameterIdent: parameterIdent || null,
        parameterValue: parameterValue || null,
        parameterName: parameterName || null,
      },
    });
  }
  return nodes;
}

function buildMultimediaObjectJson(item: InsertMultimediaPayload): JSONContent {
  const ident = item.infoEntityIdent.trim();
  const parameterContent = buildParameterContentJson(item.parameters);
  const dataType = item.dataType?.trim() || null;
  const isWebgl = dataType === "webgl";
  const isCc3d = dataType === "cc3d";
  return {
    type: "multimediaObject",
    attrs: {
      infoEntityIdent: ident,
      multimediaType: resolveMultimediaTypeForXml(item),
      dataType,
      fileType: item.fileType ?? null,
      sceneSrc: isWebgl ? null : resolveFileUrl(item.sceneSrc) || null,
      previewImgSrc: resolveFileUrl(item.previewImgSrc) || null,
      cnfPath: resolveFileUrl(item.cnfPath) || null,
      mediaSrc: isWebgl || isCc3d ? null : resolveFileUrl(item.mediaSrc) || null,
      webglUrl: isWebgl ? resolveFileUrl(item.webglUrl) || null : null,
      webglCommandTemplate: isWebgl
        ? item.webglCommandTemplate?.trim() || null
        : null,
      webglCommand: isWebgl ? item.webglCommand?.trim() || null : null,
    },
    ...(parameterContent.length > 0 ? { content: parameterContent } : {}),
  };
}

function buildMultimediaInnerContent(
  items: InsertMultimediaPayload[],
): JSONContent[] {
  const content: JSONContent[] = [];
  const title = items.find((item) => item.title?.trim())?.title?.trim();
  if (title) {
    content.push({
      type: "title",
      content: [{ type: "text", text: title }],
    });
  }
  for (const item of items) {
    const ident = item.infoEntityIdent.trim();
    if (!ident) continue;
    content.push(buildMultimediaObjectJson(item));
  }
  return content;
}

function buildMultimediaBlockNodes(
  items: InsertMultimediaPayload[],
): JSONContent[] {
  const nodes: JSONContent[] = [];
  for (const item of items) {
    const ident = item.infoEntityIdent.trim();
    if (!ident) continue;

    const multimediaContent: JSONContent[] = [];

    if (item.title?.trim()) {
      multimediaContent.push({
        type: "title",
        content: [{ type: "text", text: item.title.trim() }],
      });
    }

    multimediaContent.push(buildMultimediaObjectJson(item));
    nodes.push({ type: "multimedia", content: multimediaContent });
  }
  return nodes;
}

function insertContentIntoMultimedia(
  editor: Editor,
  multimediaPos: number,
  multimedia: PMNode,
  innerContent: JSONContent[],
): boolean {
  const innerFrom = multimediaPos + 1;
  const innerTo = multimediaPos + multimedia.nodeSize - 1;
  if (innerFrom >= innerTo) {
    return editor.chain().focus().insertContentAt(innerFrom, innerContent).run();
  }
  return editor
    .chain()
    .focus()
    .deleteRange({ from: innerFrom, to: innerTo })
    .insertContentAt(innerFrom, innerContent)
    .run();
}

/** 在光标处插入 S1000D `multimedia` / `multimediaObject` 块 */
export function insertMultimediaIntoEditor(
  editor: Editor,
  items: InsertMultimediaPayload[],
  options?: InsertMultimediaOptions,
): boolean {
  if (items.length === 0) return false;

  const intent = options?.fmftInsertIntent ?? "sibling";

  if (intent === "sibling") {
    const nodes = buildMultimediaBlockNodes(items);
    if (nodes.length === 0) return false;
    const ok = insertSiblingFmftNodesFromToolbar(editor, nodes);
    if (ok) {
      normalizeIpdDocInEditor(editor);
      ensureParaAfterHostInsert(editor, resolveHostBlockPosFromSelection(editor));
    }
    return ok;
  }

  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    const selected = selection.node;
    if (selected.type.name === "multimedia") {
      const innerContent = buildMultimediaInnerContent(items);
      if (innerContent.length === 0) return false;
      return insertContentIntoMultimedia(
        editor,
        selection.from,
        selected,
        innerContent,
      );
    }
  }

  const nodes = buildMultimediaBlockNodes(items);
  if (nodes.length === 0) return false;

  const inserted = insertFmftNodesIntoEditor(editor, nodes);
  if (!inserted.ok) return false;

  ensureParaAfterHostInsert(editor, inserted.fmftBlockPos);
  return true;
}
