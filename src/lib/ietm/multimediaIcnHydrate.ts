import type { Editor } from "@tiptap/core";
import {
  fetchIcnInfoList,
  type IcnInfoRow,
} from "./icnInfo";
import { resolveFileUrl } from "../ietm/fileUrl";
import { resolveMultimediaTypeForXml } from "../s1000d/multimediaType";
import { useIcnInfoStore } from "../../store/icnInfoStore";

/** 与插入多媒体 mock 共用的演示 MP4 */
export const DEMO_MULTIMEDIA_MP4 =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

/** 本地 Demo：图解类热点测试 SVG（`public/demo/绘图.svg`） */
export const DEMO_IPD_HOTSPOT_SVG = "/demo/绘图.svg";

/** 本地无 API 时，已知样本 ICN 的演示媒体（与 ReferencePublicationModal mock 第 3 条一致） */
const DEMO_ICN_BY_CODE: Record<
  string,
  {
    dataType?: string | null;
    fileType?: string | null;
    mediaSrc?: string;
    sceneSrc?: string;
    previewImgSrc?: string | null;
    multimediaType?: string;
  }
> = {
  "ICN-XXX-000003-10003": {
    dataType: null,
    fileType: "mp4",
    mediaSrc: DEMO_MULTIMEDIA_MP4,
    previewImgSrc: "https://picsum.photos/seed/ietm3/300/200",
    multimediaType: "video",
  },
};

export type MultimediaObjectHydrateAttrs = {
  dataType?: string | null;
  fileType?: string | null;
  mediaSrc?: string | null;
  sceneSrc?: string | null;
  previewImgSrc?: string | null;
  cnfPath?: string | null;
  multimediaType?: string;
};

export function icnInfoRowToMultimediaAttrs(
  row: IcnInfoRow,
): MultimediaObjectHydrateAttrs {
  const dataType = row.dataType?.trim() || null;
  const fileType = row.fileType?.trim().toLowerCase() || null;

  if (dataType === "cc3d") {
    return {
      dataType: "cc3d",
      fileType: fileType ?? "zip",
      sceneSrc: resolveFileUrl(row.filePath),
      previewImgSrc: resolveFileUrl(row.thPath),
      cnfPath: row.cnfPath ? resolveFileUrl(row.cnfPath) : null,
      multimediaType: "3D",
    };
  }

  const isVideo = fileType === "mp4" || fileType === "webm";
  return {
    dataType,
    fileType,
    mediaSrc: isVideo ? resolveFileUrl(row.filePath) : null,
    previewImgSrc: resolveFileUrl(row.thPath),
    multimediaType: resolveMultimediaTypeForXml({
      dataType,
      fileType,
    }),
  };
}

async function resolveIcnAttrsByCode(
  code: string,
  apiBaseUrl: string,
  icnInfoPath: string,
): Promise<MultimediaObjectHydrateAttrs | null> {
  const demo = DEMO_ICN_BY_CODE[code];
  if (demo) return demo;

  if (!apiBaseUrl.trim()) return null;

  try {
    const { list } = await fetchIcnInfoList({
      apiBaseUrl,
      path: icnInfoPath,
      keyword: code,
      pageSize: 20,
    });
    const row = list.find((r) => r.fullCode === code);
    return row ? icnInfoRowToMultimediaAttrs(row) : null;
  } catch (err) {
    console.warn("[ietm] ICN 回填失败:", code, err);
    return null;
  }
}

function needsMultimediaHydration(attrs: Record<string, unknown>): boolean {
  const ident = String(attrs.infoEntityIdent ?? "").trim();
  if (!ident) return false;
  const mediaSrc = String(attrs.mediaSrc ?? "").trim();
  const sceneSrc = String(attrs.sceneSrc ?? "").trim();
  return !mediaSrc && !sceneSrc;
}

/**
 * 为仅有 `infoEntityIdent`（及 `multimediaType`）的 `multimediaObject` 回填
 * `mediaSrc` / `sceneSrc` 等，以便 NodeView 渲染视频或 3D。
 */
export async function hydrateMultimediaObjectsInEditor(
  editor: Editor,
): Promise<void> {
  const pending: Array<{ pos: number; code: string }> = [];
  const codes = new Set<string>();

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "multimediaObject") return;
    if (!needsMultimediaHydration(node.attrs as Record<string, unknown>))
      return;
    const code = String(node.attrs.infoEntityIdent ?? "").trim();
    pending.push({ pos, code });
    codes.add(code);
  });

  if (pending.length === 0) return;

  const { apiBaseUrl, icnInfoPath } = useIcnInfoStore.getState();
  const resolved = new Map<string, MultimediaObjectHydrateAttrs>();
  await Promise.all(
    [...codes].map(async (code) => {
      const attrs = await resolveIcnAttrsByCode(
        code,
        apiBaseUrl,
        icnInfoPath,
      );
      if (attrs) resolved.set(code, attrs);
    }),
  );

  if (resolved.size === 0) return;

  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "multimediaObject") return;
    if (!needsMultimediaHydration(node.attrs as Record<string, unknown>))
      return;
    const code = String(node.attrs.infoEntityIdent ?? "").trim();
    const patch = resolved.get(code);
    if (!patch) return;
    updates.push({
      pos,
      attrs: {
        ...node.attrs,
        ...patch,
        multimediaType:
          patch.multimediaType ??
          node.attrs.multimediaType ??
          resolveMultimediaTypeForXml({
            multimediaType: node.attrs.multimediaType as string,
            dataType: patch.dataType as string,
            fileType: patch.fileType as string,
          }),
      },
    });
  });

  if (updates.length === 0) return;

  const tr = editor.state.tr;
  updates
    .sort((a, b) => b.pos - a.pos)
    .forEach(({ pos, attrs }) => {
      tr.setNodeMarkup(pos, undefined, attrs);
    });

  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
}
