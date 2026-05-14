import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

function graphicSrcFromAttrs(src: unknown): string {
  if (typeof src === "string") return src.trim();
  if (src == null) return "";
  const s = String(src).trim();
  return s;
}

/**
 * S1000D `graphic`：在编辑器内用标准 `<img>` 呈现；`src` 仅来自源 XML `xlink:href`，
 * 无 `xlink:href` 时 `src` 为空字符串（不套用 `infoEntityIdent` 等其它属性）。
 */
export function GraphicNodeView(props: NodeViewProps) {
  const { node } = props;
  const src = graphicSrcFromAttrs(node.attrs.src);
  const ident = String(node.attrs.infoEntityIdent ?? "").trim();
  const id = String(node.attrs.id ?? "").trim();
  const hint = [ident && `infoEntityIdent: ${ident}`, id && `id: ${id}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-graphic-node"
      data-s1000d-node="graphic"
      contentEditable={false}
    >
      <img
        className={
          src
            ? "s1000d-graphic-img"
            : "s1000d-graphic-img s1000d-graphic-img--empty"
        }
        src={src}
        alt={ident || id || "graphic"}
        title={hint || (src ? undefined : "无 xlink:href（src 为空）")}
        draggable={false}
      />
    </NodeViewWrapper>
  );
}
