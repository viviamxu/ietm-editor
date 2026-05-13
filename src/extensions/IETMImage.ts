import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { IETMImageNodeView } from './IETMImageNodeView'

export const IETMImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      figureId: {
        default: 'fig-1',
        parseHTML: (element) => element.getAttribute('data-figure-id'),
        renderHTML: (attributes) =>
          attributes.figureId
            ? { 'data-figure-id': attributes.figureId as string }
            : {},
      },
      unitOfMeasure: {
        default: 'ph01(h)',
        parseHTML: (element) =>
          element.getAttribute('data-unit-of-measure'),
        renderHTML: (attributes) =>
          attributes.unitOfMeasure
            ? {
                'data-unit-of-measure': attributes.unitOfMeasure as string,
              }
            : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(IETMImageNodeView)
  },
})
