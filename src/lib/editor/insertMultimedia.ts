import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { ensureParaAfterHostInsert } from "./insertParaAfterFmftBlock";
import { insertFmftNodesIntoEditor } from "./resolveProcedureFmftInsertPos";
import { resolveFileUrl } from "../ietm/fileUrl";
import { resolveMultimediaTypeForXml } from "../s1000d/multimediaType";

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
   * ICN 业务类型：`"cc3d"` 三维 | `"math"` 公式 | `null` 其它。
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

/** 在光标处插入 S1000D `multimedia` / `multimediaObject` 块 */
export function insertMultimediaIntoEditor(
  editor: Editor,
  items: InsertMultimediaPayload[],
): boolean {
  if (items.length === 0) return false;
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

    const parameterContent = buildParameterContentJson(item.parameters);
    multimediaContent.push({
      type: "multimediaObject",
      attrs: {
        infoEntityIdent: ident,
        multimediaType: resolveMultimediaTypeForXml(item),
        dataType: item.dataType ?? null,
        fileType: item.fileType ?? null,
        sceneSrc: resolveFileUrl(item.sceneSrc) || null,
        previewImgSrc: resolveFileUrl(item.previewImgSrc) || null,
        cnfPath: resolveFileUrl(item.cnfPath) || null,
        mediaSrc: resolveFileUrl(item.mediaSrc) || null,
      },
      ...(parameterContent.length > 0 ? { content: parameterContent } : {}),
    });

    nodes.push({ type: "multimedia", content: multimediaContent });
  }
  if (nodes.length === 0) return false;

  const inserted = insertFmftNodesIntoEditor(editor, nodes);
  if (!inserted.ok) return false;

  ensureParaAfterHostInsert(editor, inserted.fmftBlockPos);
  return true;
}
