import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

/**
 * S1000D `attentionSymbol`：文档模型占位；展示与交互由父级 `warning`/`caution`/`note`
 * 左侧图标列承担（见 `attentionBlockSymbolIcon`）。
 */
export function AttentionSymbolNodeView(props: NodeViewProps) {
  void props;
  return (
    <NodeViewWrapper
      as="span"
      className="s1000d-attention-symbol-node s1000d-attention-symbol-node--doc-only"
      data-s1000d-node="attentionSymbol"
      contentEditable={false}
      aria-hidden
    />
  );
}
