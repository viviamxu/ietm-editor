const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * 从源 XML / DOM 的 `graphic`（或其它带 XLink 的元素）上读取 `xlink:href`。
 * 兼容 `getAttributeNS`、字面量 `xlink:href` 及大小写变体。
 */
export function readXlinkHrefFromElement(el: Element): string {
  const fromNs = el.getAttributeNS(XLINK_NS, "href");
  if (fromNs?.trim()) return fromNs.trim();
  const prefixed =
    el.getAttribute("xlink:href") ??
    el.getAttribute("XLINK:HREF") ??
    el.getAttribute("xlink:HREF");
  if (prefixed?.trim()) return prefixed.trim();
  return "";
}

/**
 * 从 `graphic` / 编辑器内 `img[data-s1000d-node=graphic]` 读取预览地址。
 * 优先 `xlink:href`，其次 `src` / `data-editor-src`。
 */
export function readGraphicSrcFromElement(el: Element): string {
  const xlink = readXlinkHrefFromElement(el);
  if (xlink) return xlink;

  const fromData = el.getAttribute("data-editor-src");
  if (fromData?.trim()) return fromData.trim();

  if (el.tagName === "IMG" || el.localName.toLowerCase() === "img") {
    const s = el.getAttribute("src");
    if (s?.trim()) return s.trim();
  }

  const nested = el.querySelector('img[data-s1000d-node="graphic"]');
  const nestedSrc = nested?.getAttribute("src");
  if (nestedSrc?.trim()) return nestedSrc.trim();

  return "";
}
