import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

/**
 * `levelledPara` 的 WYSIWYG 外壳：保留 ProseMirror 内容区，便于继续编辑子节点。
 * 输出 XML 时由 `serializeASTToXML` 负责还原为 `<levelledPara>...</levelledPara>`。
 */
export function LevelledParaNodeView(props: NodeViewProps) {
  void props
  return (
    <NodeViewWrapper
      as="section"
      className="s1000d-levelled-para"
      data-s1000d-node="levelledPara"
    >
      <NodeViewContent className="s1000d-levelled-para__content" />
    </NodeViewWrapper>
  )
}
