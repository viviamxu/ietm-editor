import { resolveFileUrl } from "../ietm/fileUrl";

const HOTSPOT_SHAPE_TAGS = ["circle", "ellipse", "rect"] as const;

function readShapeMarkerLabel(el: Element): string | null {
  const inkscape = el.getAttribute("inkscape:label")?.trim();
  if (inkscape) return inkscape;
  const label = el.getAttribute("label")?.trim();
  return label || null;
}

/**
 * 从 SVG 文本解析热点：带 `inkscape:label` 或 `label` 的 circle / ellipse / rect，
 * 返回其 `id`（作为 `hotspotTitle` / 形状标识）。
 */
export function parseSvgHotspotShapeIds(svgText: string): string[] {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const tag of HOTSPOT_SHAPE_TAGS) {
    doc.querySelectorAll(tag).forEach((el) => {
      if (!readShapeMarkerLabel(el)) return;
      const shapeId = el.getAttribute("id")?.trim();
      if (!shapeId || seen.has(shapeId)) return;
      seen.add(shapeId);
      ids.push(shapeId);
    });
  }

  return ids;
}

export function isSvgImageSource(src: string): boolean {
  const s = src.trim().toLowerCase();
  return s.endsWith(".svg") || s.startsWith("data:image/svg+xml");
}

/** 拉取 SVG 文本（URL 或 data URI）。 */
export async function fetchSvgText(src: string): Promise<string | null> {
  const trimmed = resolveFileUrl(src.trim());
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith("data:image/svg")) {
    try {
      const comma = trimmed.indexOf(",");
      if (comma < 0) return null;
      const meta = trimmed.slice(0, comma);
      const payload = trimmed.slice(comma + 1);
      if (meta.includes(";base64")) {
        return atob(payload);
      }
      return decodeURIComponent(payload);
    } catch {
      return null;
    }
  }

  if (!isSvgImageSource(trimmed)) return null;

  try {
    const res = await fetch(trimmed);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("svg") && !trimmed.toLowerCase().endsWith(".svg")) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}
