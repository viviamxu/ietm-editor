import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import {
  SOURCE_XML_ATTR_KEYS,
  hasXmlAttr,
} from '../lib/s1000d/sourceXmlAttrKeys'
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

  parseHTML() {
    const rules = this.parent?.() ?? []
    return rules.map((rule) => {
      const prevGetAttrs = rule.getAttrs
      if (typeof prevGetAttrs !== "function") return rule
      return {
        ...rule,
        getAttrs: (element: HTMLElement) => {
          const base = prevGetAttrs(element)
          if (base === false) return false
          const attrs: Record<string, unknown> =
            typeof base === "object" && base !== null && !Array.isArray(base)
              ? { ...base }
              : {}
          const imgKeys: string[] = []
          if (hasXmlAttr(element, "src")) imgKeys.push("src")
          if (hasXmlAttr(element, "alt")) imgKeys.push("alt")
          if (hasXmlAttr(element, "title")) imgKeys.push("title")
          if (hasXmlAttr(element, "width")) imgKeys.push("width")
          if (hasXmlAttr(element, "height")) imgKeys.push("height")
          if (hasXmlAttr(element, "data-figure-id")) imgKeys.push("figureId")
          if (hasXmlAttr(element, "data-unit-of-measure")) {
            imgKeys.push("unitOfMeasure")
          }
          attrs[SOURCE_XML_ATTR_KEYS] = imgKeys
          return attrs
        },
      }
    }) as typeof rules
  },

  addNodeView() {
    return ReactNodeViewRenderer(IETMImageNodeView)
  },
})
