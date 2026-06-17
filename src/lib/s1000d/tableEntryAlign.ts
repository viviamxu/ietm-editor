import type { JSONContent } from "@tiptap/core";

const PARA_NODE_TYPES = new Set(["para", "paragraph"]);

/** S1000D `entry@align` 与编辑器 `para.textAlign` 的可互转取值 */
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

function normalizeAlign(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return ALIGN_VALUES.has(v) ? v : null;
}

/** 从单元格内 `para.textAlign` 推导导出的 `entry@align`（`left` 省略）。 */
export function deriveEntryAlignFromParas(entry: JSONContent): string | null {
  for (const child of entry.content ?? []) {
    if (!PARA_NODE_TYPES.has(child.type ?? "")) continue;
    const align = normalizeAlign(child.attrs?.textAlign);
    if (align && align !== "left") return align;
  }
  return null;
}

/** 导出 `entry` 时合并 attrs：`align` 以子 `para.textAlign` 为准。 */
export function resolveEntryAttrsForExport(
  attrs: JSONContent["attrs"],
  entry: JSONContent,
): JSONContent["attrs"] {
  const next = { ...(attrs ?? {}) };
  const align = deriveEntryAlignFromParas(entry);
  next.align = align;
  return next;
}

/** 导入前：将 `entry` / `td` / `th` 的 `align` 写到子 `para`/`p` 的 `style`，供 TextAlign 解析。 */
export function propagateEntryAlignToParasInFragment(fragment: string): string {
  if (!/\balign\s*=/i.test(fragment)) return fragment;

  const wrapped = `<root>${fragment}</root>`;
  const doc = new DOMParser().parseFromString(wrapped, "application/xml");
  if (doc.querySelector("parsererror")) return fragment;

  for (const cell of doc.querySelectorAll("entry, td, th")) {
    const align = normalizeAlign(cell.getAttribute("align"));
    if (!align || align === "left") continue;

    for (const para of cell.querySelectorAll("para, p")) {
      const prev = para.getAttribute("style")?.trim() ?? "";
      const withoutTextAlign = prev
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^text-align\s*:/i.test(part))
        .join("; ");
      const style = withoutTextAlign
        ? `${withoutTextAlign}; text-align: ${align}`
        : `text-align: ${align}`;
      para.setAttribute("style", style);
    }
  }

  const root = doc.documentElement;
  const parts: string[] = [];
  for (const child of Array.from(root.childNodes)) {
    parts.push(new XMLSerializer().serializeToString(child));
  }
  return parts.join("");
}
