import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { ensureParaAfterFmftFromSelection } from "./insertParaAfterFmftBlock";
import { resolveMultimediaTypeForXml } from "../s1000d/multimediaType";

/** 程序类：光标在 `mainProcedure` 内但不在 `proceduralStep` 时，落到最近步骤末尾。 */
function resolveProcedureMultimediaInsertPos(editor: Editor): number | null {
  const { selection } = editor.state;
  const $from = selection.$from;

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "proceduralStep") return null;
  }

  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name !== "mainProcedure") continue;

    const main = $from.node(d);
    const mainPos = $from.before(d);
    if (main.childCount === 0) return null;

    let stepPos = mainPos + 1;
    let step: PMNode = main.child(0);
    for (let i = 1; i < main.childCount; i++) {
      const next = main.child(i);
      const nextPos = stepPos + step.nodeSize;
      if (selection.from >= nextPos) {
        stepPos = nextPos;
        step = next;
      } else {
        break;
      }
    }

    return stepPos + step.nodeSize - 1;
  }

  return null;
}

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
        cnfPath: item.cnfPath ?? null,
        mediaSrc: item.mediaSrc ?? null,
      },
    });

    nodes.push({ type: "multimedia", content: multimediaContent });
  }
  if (nodes.length === 0) return false;

  const { selection } = editor.state;
  let inserted: boolean;

  if (selection instanceof NodeSelection) {
    inserted = editor
      .chain()
      .focus()
      .insertContentAt(selection.from + selection.node.nodeSize, nodes)
      .run();
  } else {
    const procedureInsertPos = resolveProcedureMultimediaInsertPos(editor);
    inserted =
      procedureInsertPos != null
        ? editor
            .chain()
            .focus()
            .insertContentAt(procedureInsertPos, nodes)
            .run()
        : editor.chain().focus().insertContent(nodes).run();
  }

  if (!inserted) return false;

  ensureParaAfterFmftFromSelection(editor);
  return true;
}
