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
