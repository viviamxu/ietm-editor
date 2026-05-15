import { Extension } from '@tiptap/core'
import { INSPECTABLE_NODE_TYPE_LIST } from '../lib/editor/inspectableNodeTypes'
import { SOURCE_XML_ATTR_KEYS } from '../lib/s1000d/sourceXmlAttrKeys'

/**
 * 为可检视的 S1000D 相关节点统一挂上 `sourceXmlAttrKeys`，
 * 具体取值由各节点 `parseHTML` / `getAttrs` 写入；不参与 XML 导出。
 */
export const SourceXmlAttrKeysExtension = Extension.create({
  name: 'sourceXmlAttrKeysTracking',

  addGlobalAttributes() {
    return [
      {
        types: [...INSPECTABLE_NODE_TYPE_LIST],
        attributes: {
          [SOURCE_XML_ATTR_KEYS]: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
        },
      },
    ]
  },
})
