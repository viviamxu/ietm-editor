import { resolveFileUrl } from "../ietm/fileUrl";
import { readXlinkHrefFromElement } from "./xlinkHref";

function elementDepth(el: Element): number {
  let d = 0;
  let p: Element | null = el.parentElement;
  while (p) {
    d++;
    p = p.parentElement;
  }
  return d;
}

function renameXmlElementTag(el: Element, newName: string) {
  const doc = el.ownerDocument;
  if (!doc) return;
  const neu = doc.createElement(newName);
  for (const attr of Array.from(el.attributes)) {
    neu.setAttribute(attr.name, attr.value);
  }
  while (el.firstChild) {
    neu.appendChild(el.firstChild);
  }
  el.parentNode?.replaceChild(neu, el);
}

function readInfoEntityIdent(el: Element): string | null {
  return (
    el.getAttribute("infoEntityIdent") ??
    el.getAttribute("infoentityident")
  );
}

function graphicHasHotspotChildren(graphic: Element): boolean {
  return Array.from(graphic.children).some(
    (c) => c.localName.toLowerCase() === "hotspot",
  );
}

function replaceGraphicWithImportImg(graphic: Element): void {
  const doc = graphic.ownerDocument;
  if (!doc) return;

  const href = readXlinkHrefFromElement(graphic);
  const src =
    graphic.getAttribute("src")?.trim() ||
    (href ? resolveFileUrl(href) : "") ||
    "";
  const iei = readInfoEntityIdent(graphic);
  const id = graphic.getAttribute("id");

  const img = doc.createElement("img");
  img.setAttribute("data-s1000d-node", "graphic");
  img.setAttribute("class", "s1000d-graphic-img");
  img.setAttribute("draggable", "false");
  if (src) img.setAttribute("src", src);
  if (iei) img.setAttribute("data-info-entity-ident", iei);
  if (id) img.setAttribute("data-graphic-id", id);

  graphic.parentNode?.replaceChild(img, graphic);
}

/** 将单个 `graphic` 的 `xlink:href` 写入 `src`（保留 `hotspot` 子节点时不替换为 `img`）。 */
export function bindGraphicElementSrcForHtmlImport(graphic: Element): void {
  if (graphic.getAttribute("src")?.trim()) return;
  const href = readXlinkHrefFromElement(graphic);
  if (!href) return;
  const src = resolveFileUrl(href);
  if (src) graphic.setAttribute("src", src);
}

function renameFigureElementsForEditorImport(root: Element): void {
  const figures = Array.from(root.getElementsByTagName("figure"));
  figures.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const fig of figures) {
    renameXmlElementTag(fig, "s1000d-xml-figure");
  }
}

function convertGraphicElementsForEditorImport(root: Element): void {
  const graphics = Array.from(root.getElementsByTagName("graphic"));
  for (const graphic of graphics) {
    if (graphicHasHotspotChildren(graphic)) {
      bindGraphicElementSrcForHtmlImport(graphic);
      continue;
    }
    replaceGraphicWithImportImg(graphic);
  }
}

/**
 * XML 导入前：`figure` → `s1000d-xml-figure`（避开 HTML5 `<figure>` 语义），
 * `graphic` → `img[data-s1000d-node=graphic]`（混排时子节点才能留在块内）。
 */
export function prepareFigureGraphicsForEditorImport(root: Element): void {
  renameFigureElementsForEditorImport(root);
  convertGraphicElementsForEditorImport(root);
}

/** @deprecated 使用 {@link prepareFigureGraphicsForEditorImport} */
export function bindFigureGraphicsForEditorImport(root: Element): void {
  prepareFigureGraphicsForEditorImport(root);
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

function extractQuotedAttr(attrs: string, name: string): string {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(["'])((?:\\\\.|(?!\\1).)*?)\\1`,
    "i",
  );
  const m = re.exec(attrs);
  return m?.[2]?.trim() ?? "";
}

function escapeAttrForQuotedDouble(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildImgTagFromGraphicAttrs(attrs: string): string {
  const href = extractXlinkHrefFromAttrString(attrs);
  const existingSrc = extractQuotedAttr(attrs, "src");
  const src = existingSrc || (href ? resolveFileUrl(href) : "");
  const iei =
    extractQuotedAttr(attrs, "infoEntityIdent") ||
    extractQuotedAttr(attrs, "infoentityident");
  const id = extractQuotedAttr(attrs, "id");

  let imgAttrs =
    ' data-s1000d-node="graphic" class="s1000d-graphic-img" draggable="false"';
  if (src) imgAttrs += ` src="${escapeAttrForQuotedDouble(src)}"`;
  if (iei) imgAttrs += ` data-info-entity-ident="${escapeAttrForQuotedDouble(iei)}"`;
  if (id) imgAttrs += ` data-graphic-id="${escapeAttrForQuotedDouble(id)}"`;
  return `<img${imgAttrs} />`;
}

/** `text/html` 导入前：S1000D `figure` 换名，空 `graphic` 换 `img`。 */
export function renameS1000dFigureTagsForHtmlImport(fragment: string): string {
  return fragment
    .replace(/<figure(\s[^>]*)?>/gi, "<s1000d-xml-figure$1>")
    .replace(/<\/figure>/gi, "</s1000d-xml-figure>");
}

function bindGraphicSrcInRemainingGraphicTags(fragment: string): string {
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

function convertEmptyGraphicsToImgInHtmlFragment(fragment: string): string {
  if (!/<graphic\b/i.test(fragment)) return fragment;

  let s = fragment.replace(
    /<graphic\b([^>]*?)\s*\/\s*>/gi,
    (_match, attrs: string) => buildImgTagFromGraphicAttrs(attrs),
  );
  s = s.replace(
    /<graphic\b([^>]*?)>\s*<\/graphic>/gi,
    (_match, attrs: string) => buildImgTagFromGraphicAttrs(attrs),
  );
  return bindGraphicSrcInRemainingGraphicTags(s);
}

/** 字符串片段：figure 换名 + graphic 转 img（粘贴 / 直传 HTML 片段）。 */
export function prepareFigureGraphicsInHtmlFragment(fragment: string): string {
  return convertEmptyGraphicsToImgInHtmlFragment(
    renameS1000dFigureTagsForHtmlImport(fragment),
  );
}

/** @deprecated 使用 {@link prepareFigureGraphicsInHtmlFragment} */
export function bindFigureGraphicsInHtmlFragment(fragment: string): string {
  return prepareFigureGraphicsInHtmlFragment(fragment);
}
