import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

import { useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";

function graphicSrcFromAttrs(src: unknown): string {
  if (typeof src === "string") return src.trim();
  if (src == null) return "";
  const s = String(src).trim();
  return s;
}

/**
 * S1000D `graphic`：在编辑器内用标准 `<img>` 呈现；`src` 仅来自源 XML `xlink:href`，
 * 无 `xlink:href` 时 `src` 为空字符串（不套用 `infoEntityIdent` 等其它属性）。
 * 点击选中后按 Delete / Backspace 可删除本张图（保留 figure 与其它 graphic）。
 */
export function GraphicNodeView(props: NodeViewProps) {
  const { editor, getPos, node, selected } = props;
  const { readOnly } = useNodeViewEditorState(editor);
  const src = graphicSrcFromAttrs(node.attrs.src);
  const ident = String(node.attrs.infoEntityIdent ?? "").trim();
  const id = String(node.attrs.id ?? "").trim();
  const hint = [ident && `infoEntityIdent: ${ident}`, id && `id: ${id}`]
    .filter(Boolean)
    .join(" · ");
  const deleteHint = readOnly ? undefined : "选中后按 Delete 或 Backspace 删除";

  const selectGraphic = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (readOnly) return;
      const p = getPos?.();
      if (p == null) return;
      editor.chain().focus().setNodeSelection(p).run();
    },
    [editor, getPos, readOnly],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={
        selected
          ? "s1000d-graphic-node s1000d-graphic-node--selected"
          : "s1000d-graphic-node"
      }
      data-s1000d-node="graphic"
      contentEditable={false}
      title={
        deleteHint ??
        (hint || (src ? undefined : "无 xlink:href（src 为空）"))
      }
      onMouseDown={selectGraphic}
    >
      <img
        className={
          src
            ? "s1000d-graphic-img"
            : "s1000d-graphic-img s1000d-graphic-img--empty"
        }
        src={src}
        alt={ident || id || "graphic"}
        title={hint || deleteHint || (src ? undefined : "无 xlink:href（src 为空）")}
        draggable={false}
      />
    </NodeViewWrapper>
  );
}
