import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

/** S1000D `multimedia`：`title?` + `multimediaObject+`。 */
export function MultimediaNodeView(_props: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="section"
      className="s1000d-multimedia s1000d-multimedia-node"
      data-s1000d-node="multimedia"
    >
      <div className="s1000d-multimedia__content">
        <NodeViewContent className="s1000d-multimedia__inner" />
      </div>
    </NodeViewWrapper>
  );
}
