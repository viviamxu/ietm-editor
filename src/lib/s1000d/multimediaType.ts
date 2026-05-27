/** S1000D `multimediaObject@multimediaType` 常用取值（Issue 4.2 等）。 */
export type S1000dMultimediaType =
  | "video"
  | "audio"
  | "3D"
  | "computerGraphic"
  | "other";

/**
 * 解析写入 XML 的 `multimediaType`：优先显式值，否则由 ICN/编辑器字段推断。
 */
export function resolveMultimediaTypeForXml(attrs: {
  multimediaType?: string | null;
  dataType?: string | null;
  fileType?: string | null;
}): S1000dMultimediaType {
  const explicit = attrs.multimediaType?.trim();
  if (explicit) return explicit as S1000dMultimediaType;

  const dataType = attrs.dataType?.trim();
  if (dataType === "cc3d") return "3D";

  const fileType = attrs.fileType?.trim().toLowerCase();
  if (fileType === "mp4" || fileType === "webm") return "video";
  if (fileType === "mp3" || fileType === "wav") return "audio";

  return "other";
}
