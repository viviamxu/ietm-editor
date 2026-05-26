import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Film } from "lucide-react";

/** S1000D `multimediaObject`：展示 `infoEntityIdent` 占位。 */
export function MultimediaObjectNodeView(props: NodeViewProps) {
  const ident = String(props.node.attrs.infoEntityIdent ?? "").trim();
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-multimedia-object-node"
      data-s1000d-node="multimediaObject"
      contentEditable={false}
    >
      <Film size={18} aria-hidden className="s1000d-multimedia-object-node__icon" />
      <span className="s1000d-multimedia-object-node__label">
        {ident || "（未设置 infoEntityIdent）"}
      </span>
    </NodeViewWrapper>
  );
}
