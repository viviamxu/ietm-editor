import type { InsertPublicationMode } from "../../store/insertPublicationModalStore";
import type { IcnInfoRow } from "./icnInfo";
import { resolveFileUrl } from "./fileUrl";

/** 插入图片 / 多媒体 / 符号弹框列表行 */
export type PublicationRow = {
  id: string;
  menuId: string;
  title: string;
  code: string;
  version: string;
  security: string;
  /** 弹框预览缩略图 */
  preview: string;
  /** 业务类型（后端 dataType）；mock 视频为 null */
  dataType?: string | null;
  /** 文件后缀，如 mp4 */
  fileType?: string | null;
  /** 主文件 URL（视频 mp4 等） */
  filePath?: string;
  /** 封面/缩略图 */
  thPath?: string;
};

export function icnInfoRowToPublicationRow(row: IcnInfoRow): PublicationRow {
  const preview = resolveFileUrl(row.thPath ?? row.filePath);
  return {
    id: String(row.id),
    menuId: "",
    title: row.title,
    code: row.fullCode,
    version: String(row.issueNumber ?? "1").padStart(3, "0"),
    security: String(row.securityClassification ?? "1").padStart(2, "0"),
    preview,
    dataType: row.dataType,
    fileType: row.fileType,
    filePath: resolveFileUrl(row.filePath),
    thPath: row.thPath ? resolveFileUrl(row.thPath) : preview,
  };
}

function isVideoFileType(fileType: string | null | undefined): boolean {
  const ft = fileType?.trim().toLowerCase();
  return ft === "mp4" || ft === "webm";
}

/** 按弹框用途过滤 ICN 行（image/symbol 排除视频与 3D；multimedia 保留可播放项）。 */
export function publicationRowMatchesMode(
  row: PublicationRow,
  mode: InsertPublicationMode,
): boolean {
  if (mode === "multimedia") {
    if (isVideoFileType(row.fileType)) return true;
    if (row.dataType === "cc3d" || row.dataType === "webgl" || row.dataType === "math") return true;
    return false;
  }
  if (isVideoFileType(row.fileType)) return false;
  if (row.dataType === "cc3d" || row.dataType === "webgl") return false;
  return true;
}
