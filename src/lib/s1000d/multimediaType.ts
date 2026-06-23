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
  if (dataType === "webgl") return "computerGraphic";

  const fileType = attrs.fileType?.trim().toLowerCase();
  if (fileType === "mp4" || fileType === "webm") return "video";
  if (fileType === "mp3" || fileType === "wav") return "audio";
  if (fileType === "zip") return "3D";

  return "other";
}

type MultimediaObjectXlinkAttrs = {
  dataType?: string | null;
  webglUrl?: string | null;
  sceneSrc?: string | null;
  mediaSrc?: string | null;
};

/**
 * 解析写入 `multimediaObject@xlink:href` 的 URL。
 * WebGL 仅使用 `webglUrl`；cc3d 使用 `sceneSrc`；视频等使用 `mediaSrc`。
 */
export function resolveMultimediaObjectXlinkHrefForXml(
  attrs: MultimediaObjectXlinkAttrs,
): string {
  const dataType = attrs.dataType?.trim();
  if (dataType === "webgl") {
    return String(attrs.webglUrl ?? "").trim();
  }
  if (dataType === "cc3d") {
    return String(attrs.sceneSrc ?? "").trim();
  }
  const mediaSrc = String(attrs.mediaSrc ?? "").trim();
  if (mediaSrc) return mediaSrc;
  const sceneSrc = String(attrs.sceneSrc ?? "").trim();
  if (sceneSrc) return sceneSrc;
  return "";
}
