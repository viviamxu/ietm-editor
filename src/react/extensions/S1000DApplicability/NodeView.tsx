import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useMemo } from 'react'
import { useApplicabilityContext } from '../../context/ApplicabilityContext'
import type { S1000DApplicabilityAttributes } from './extension'

function parseModelCodes(rawValue: string) {
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function S1000DApplicabilityNodeView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const { activePlatform, showOnlyApplicable } = useApplicabilityContext()
  const attrs = node.attrs as S1000DApplicabilityAttributes
  const parsedCodes = useMemo(() => parseModelCodes(attrs.modelCodes), [attrs.modelCodes])
  const isApplicable = parsedCodes.includes(activePlatform)

  const dataApplicable = showOnlyApplicable ? String(isApplicable) : 'true'

  return (
    <NodeViewWrapper
      className="s1000d-applicability"
      data-applicable={dataApplicable}
      data-model-codes={attrs.modelCodes}
    >
      <div className="s1000d-applicability__header" contentEditable={false}>
        <span className="s1000d-applicability__title">{attrs.conditionLabel}</span>
        <label>
          条件
          <input
            value={attrs.modelCodes}
            onChange={(event) => updateAttributes({ modelCodes: event.target.value })}
            placeholder="A320,B737"
          />
        </label>
      </div>
      <NodeViewContent className="s1000d-applicability__content" />
    </NodeViewWrapper>
  )
}
