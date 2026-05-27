import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { resolveMultimediaTypeForXml } from "../s1000d/multimediaType";

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
};

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

    multimediaContent.push({
      type: "multimediaObject",
      attrs: {
        infoEntityIdent: ident,
        multimediaType: resolveMultimediaTypeForXml(item),
        dataType: item.dataType ?? null,
        fileType: item.fileType ?? null,
        sceneSrc: item.sceneSrc ?? null,
        previewImgSrc: item.previewImgSrc ?? null,
        mediaSrc: item.mediaSrc ?? null,
      },
    });

    nodes.push({ type: "multimedia", content: multimediaContent });
  }
  if (nodes.length === 0) return false;
  return editor.chain().focus().insertContent(nodes).run();
}
