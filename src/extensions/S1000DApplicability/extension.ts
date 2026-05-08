import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { S1000DApplicabilityNodeView } from './NodeView'

export interface S1000DApplicabilityAttributes {
  modelCodes: string
  conditionLabel: string
}

export const defaultApplicabilityAttributes: S1000DApplicabilityAttributes = {
  modelCodes: 'A320,B737',
  conditionLabel: 'Applicable Models',
}

export const S1000DApplicability = Node.create({
  name: 's1000dApplicability',
  group: 'block',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return {
      modelCodes: {
        default: defaultApplicabilityAttributes.modelCodes,
      },
      conditionLabel: {
        default: defaultApplicabilityAttributes.conditionLabel,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="s1000d-applicability"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 's1000d-applicability',
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(S1000DApplicabilityNodeView)
  },
})
