import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
/** figure 是否已有可展示的 graphic（含 `src` 或 `infoEntityIdent`）。 */
export function figureHasDisplayableGraphic(figure: PMNode): boolean {
  if (figure.type.name !== "figure") return false;
  let found = false;
  figure.forEach((child) => {
    if (child.type.name !== "graphic") return;
    const src = String(child.attrs.src ?? "").trim();
    const iei = String(child.attrs.infoEntityIdent ?? "").trim();
    if (src || iei) found = true;
  });
  return found;
}

/** 删除 figure 内无 `src` / `infoEntityIdent` 的空壳 graphic，便于后续插入新图。 */
export function removeEmptyGraphicsFromFigure(
  editor: Editor,
  figurePos: number,
): void {
  const figure = editor.state.doc.nodeAt(figurePos);
  if (!figure || figure.type.name !== "figure") return;

  const toDelete: { from: number; to: number }[] = [];
  let offset = figurePos + 1;
  figure.forEach((child) => {
    const childPos = offset;
    if (child.type.name === "graphic") {
      const src = String(child.attrs.src ?? "").trim();
      const iei = String(child.attrs.infoEntityIdent ?? "").trim();
      if (!src && !iei) {
        toDelete.push({ from: childPos, to: childPos + child.nodeSize });
      }
    }
    offset += child.nodeSize;
  });

  if (toDelete.length === 0) return;

  const tr = editor.state.tr;
  for (let i = toDelete.length - 1; i >= 0; i--) {
    tr.delete(toDelete[i].from, toDelete[i].to);
  }
  editor.view.dispatch(tr);
}
