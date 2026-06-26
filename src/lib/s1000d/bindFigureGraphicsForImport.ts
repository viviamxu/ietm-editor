import { resolveFileUrl } from "../ietm/fileUrl";
import { readXlinkHrefFromElement } from "./xlinkHref";

/** HTML 导入用：`div[data-s1000d-xml-figure="1"]` 外壳（与 table 的 `data-s1000d-xml-table` 同理）。 */
export const S1000D_XML_FIGURE_IMPORT_ATTR = "data-s1000d-xml-figure";
export const S1000D_XML_FIGURE_IMPORT_VALUE = "1";

const FIGURE_IMPORT_OPEN_TAGS = ["figure", "s1000d-xml-figure"] as const;

function elementDepth(el: Element): number {
  let d = 0;
  let p: Element | null = el.parentElement;
  while (p) {
    d++;
    p = p.parentElement;
  }
  return d;
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

function copyFigureAttrsToImportWrapper(
  figure: Element,
  wrapper: Element,
): void {
  for (const attr of Array.from(figure.attributes)) {
    wrapper.setAttribute(attr.name, attr.value);
  }
}

/** 将 `<figure>` 换为 `div[data-s1000d-xml-figure="1"]`，保留子节点与 figure 属性。 */
function wrapFigureElementForEditorImport(figure: Element): void {
  const doc = figure.ownerDocument;
  if (!doc || !figure.parentNode) return;

  const wrapper = doc.createElement("div");
  wrapper.setAttribute(S1000D_XML_FIGURE_IMPORT_ATTR, S1000D_XML_FIGURE_IMPORT_VALUE);
  copyFigureAttrsToImportWrapper(figure, wrapper);

  while (figure.firstChild) {
    wrapper.appendChild(figure.firstChild);
  }
  figure.parentNode.replaceChild(wrapper, figure);
}

function wrapFigureElementsForEditorImport(root: Element): void {
  const figures: Element[] = [];
  for (const tag of FIGURE_IMPORT_OPEN_TAGS) {
    figures.push(...Array.from(root.getElementsByTagName(tag)));
  }
  figures.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const fig of figures) {
    wrapFigureElementForEditorImport(fig);
  }
}

/**
 * XML DOM 导入前：`graphic` → `img[data-s1000d-node=graphic]`，
 * 再 `figure` → `div[data-s1000d-xml-figure="1"]`（避免 HTML5 `<figure>` 吞子节点）。
 */
export function prepareFigureGraphicsForEditorImport(root: Element): void {
  convertGraphicElementsForEditorImport(root);
  wrapFigureElementsForEditorImport(root);
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

function findNextFigureOpen(
  lower: string,
  cursor: number,
): { openIdx: number; tagName: string; tagLen: number } | null {
  let bestIdx = -1;
  let bestTag = "";
  let bestLen = 0;
  for (const tag of FIGURE_IMPORT_OPEN_TAGS) {
    const idx = lower.indexOf(`<${tag}`, cursor);
    if (idx === -1) continue;
    if (bestIdx === -1 || idx < bestIdx) {
      bestIdx = idx;
      bestTag = tag;
      bestLen = tag.length;
    }
  }
  if (bestIdx === -1) return null;
  return { openIdx: bestIdx, tagName: bestTag, tagLen: bestLen };
}

function findBalancedFigureCloseRange(
  fragment: string,
  lower: string,
  tagName: string,
  innerStart: number,
): { innerEndCloseStart: number; closeLen: number } | null {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}>`;
  let depth = 1;
  let pos = innerStart;
  let innerEndCloseStart = -1;

  while (depth > 0 && pos < fragment.length) {
    const iOpen = lower.indexOf(openNeedle, pos);
    const iClose = lower.indexOf(closeNeedle, pos);
    if (iClose === -1) break;

    const hasInnerOpen = iOpen !== -1 && iOpen < iClose;
    if (hasInnerOpen) {
      depth += 1;
      const gt = fragment.indexOf(">", iOpen);
      pos = gt === -1 ? iOpen + openNeedle.length : gt + 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        innerEndCloseStart = iClose;
        break;
      }
      const gt = fragment.indexOf(">", iClose);
      pos = gt === -1 ? iClose + closeNeedle.length : gt + 1;
    }
  }

  if (innerEndCloseStart === -1) return null;
  const closePiece = fragment.slice(innerEndCloseStart);
  const closeMatch = new RegExp(`<\\/\\s*${tagName}\\s*>`, "i").exec(closePiece);
  const closeLen = closeMatch?.[0]?.length ?? closeNeedle.length;
  return { innerEndCloseStart, closeLen };
}

/** 已是导入 div 外壳则跳过。 */
function isS1000dXmlFigureImportDiv(openTagFull: string): boolean {
  return new RegExp(
    `\\b${S1000D_XML_FIGURE_IMPORT_ATTR}\\s*=\\s*["']?${S1000D_XML_FIGURE_IMPORT_VALUE}["']?`,
    "i",
  ).test(openTagFull);
}

/**
 * 字符串片段：外层 S1000D `<figure>` 包进 `div[data-s1000d-xml-figure="1"]`，
 * 避免 `text/html` 解析时 HTML5 `<figure>` 语义丢弃 `graphic` / `img` 子节点。
 */
export function sanitizeS1000dXmlFiguresForHtmlImport(fragment: string): string {
  const withImgs = convertEmptyGraphicsToImgInHtmlFragment(fragment);
  const lower = withImgs.toLowerCase();
  let out = "";
  let cursor = 0;

  while (cursor < withImgs.length) {
    const next = findNextFigureOpen(lower, cursor);
    if (!next) {
      out += withImgs.slice(cursor);
      return out;
    }

    const { openIdx, tagName } = next;
    out += withImgs.slice(cursor, openIdx);

    const gtIdx = withImgs.indexOf(">", openIdx);
    if (gtIdx === -1) {
      out += withImgs.slice(openIdx);
      return out;
    }
    const openTagFull = withImgs.slice(openIdx, gtIdx + 1);

    if (isS1000dXmlFigureImportDiv(openTagFull)) {
      const innerStart = gtIdx + 1;
      const balanced = findBalancedFigureCloseRange(
        withImgs,
        lower,
        "div",
        innerStart,
      );
      if (!balanced) {
        out += withImgs.slice(openIdx);
        return out;
      }
      out += withImgs.slice(openIdx, balanced.innerEndCloseStart + balanced.closeLen);
      cursor = balanced.innerEndCloseStart + balanced.closeLen;
      continue;
    }

    const innerStart = gtIdx + 1;
    const balanced = findBalancedFigureCloseRange(
      withImgs,
      lower,
      tagName,
      innerStart,
    );
    if (!balanced) {
      out += withImgs.slice(openIdx);
      cursor = withImgs.length;
      continue;
    }
    const { innerEndCloseStart, closeLen } = balanced;
    const innerHtml = withImgs.slice(innerStart, innerEndCloseStart);

    const openInner = openTagFull.slice(1, -1).trim();
    const tagAndAttrs = openInner.replace(new RegExp(`^${tagName}\\b`, "i"), "").trim();
    const attrs = tagAndAttrs ? ` ${tagAndAttrs}` : "";
    out += `<div ${S1000D_XML_FIGURE_IMPORT_ATTR}="${S1000D_XML_FIGURE_IMPORT_VALUE}"${attrs}>${innerHtml}</div>`;

    cursor = innerEndCloseStart + closeLen;
  }

  return out;
}

/** 字符串片段：graphic 转 img + figure 包 div（粘贴 / 直传 HTML）。 */
export function prepareFigureGraphicsInHtmlFragment(fragment: string): string {
  return sanitizeS1000dXmlFiguresForHtmlImport(fragment);
}

/** @deprecated 使用 {@link prepareFigureGraphicsInHtmlFragment} */
export function bindFigureGraphicsInHtmlFragment(fragment: string): string {
  return prepareFigureGraphicsInHtmlFragment(fragment);
}
