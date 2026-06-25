import { Extension } from "@tiptap/core";

import { CREW_NATIVE_BLOCK_ID_TYPES } from "../../lib/s1000d/crewInspectableTypes";
import { s1000dIdAttributeConfig } from "../../lib/s1000d/s1000dIdAttribute";
import { SOURCE_XML_ATTR_KEYS } from "../../lib/s1000d/sourceXmlAttrKeys";

/**
 * 为操作类 `<content>/<crew>` 内块节点统一挂 `id` 与 `sourceXmlAttrKeys`。
 */
export const CrewBlockIdExtension = Extension.create({
  name: "crewBlockId",

  addGlobalAttributes() {
    return [
      {
        types: [...CREW_NATIVE_BLOCK_ID_TYPES],
        attributes: {
          id: s1000dIdAttributeConfig(),
          [SOURCE_XML_ATTR_KEYS]: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },
});
