import { resolveFileUrl } from "../ietm/fileUrl";
import { readXlinkHrefFromElement } from "./xlinkHref";

/** 将单个 `graphic` 的 `xlink:href` 写入 `src`，供后续 `text/html` 解析保留（混排时 xlink 常被剥掉）。 */
export function bindGraphicElementSrcForHtmlImport(graphic: Element): void {
  if (graphic.getAttribute("src")?.trim()) return;
  const href = readXlinkHrefFromElement(graphic);
  if (!href) return;
  const src = resolveFileUrl(href);
  if (src) graphic.setAttribute("src", src);
}

/** 在已解析的 DM 子树（`description` / `procedure` 等）上为全部 `graphic` 绑定 `src`。 */
export function bindFigureGraphicsForEditorImport(root: Element): void {
  const graphics = Array.from(root.getElementsByTagName("graphic"));
  for (const graphic of graphics) {
    bindGraphicElementSrcForHtmlImport(graphic);
  }
}

function extractXlinkHrefFromAttrString(attrs: string): string {
  const quoted =
    /\bxlink:href\s*=\s*(["'])((?:\\.|(?!\1).)*?)\1/i.exec(attrs) ??
    /\bXLINK:HREF\s*=\s*(["'])((?:\\.|(?!\1).)*?)\1/i.exec(attrs);
  if (quoted?.[2]?.trim()) return quoted[2].trim();
  const bare = /\bxlink:href\s*=\s*([^\s>]+)/i.exec(attrs);
  if (bare?.[1]) {
    return bare[1].replace(/^["']|["']$/g, "").trim();
  }
  return "";
}

function escapeAttrForQuotedDouble(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * 字符串片段：为仍带 `xlink:href` 的 `<graphic>` 补 `src`（粘贴 / 直传 HTML 片段时的兜底）。
 */
export function bindFigureGraphicsInHtmlFragment(fragment: string): string {
  if (!/<graphic\b/i.test(fragment)) return fragment;
  return fragment.replace(
    /<graphic\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs: string, end: string) => {
      if (/\bsrc\s*=\s*["'][^"']+["']/i.test(attrs)) return match;
      const href = extractXlinkHrefFromAttrString(attrs);
      if (!href) return match;
      const src = resolveFileUrl(href);
      if (!src) return match;
      const escaped = escapeAttrForQuotedDouble(src);
      const trimmedEnd = end.trimStart();
      if (trimmedEnd.startsWith("/")) {
        return `<graphic${attrs} src="${escaped}" />`;
      }
      return `<graphic${attrs} src="${escaped}">`;
    },
  );
}
