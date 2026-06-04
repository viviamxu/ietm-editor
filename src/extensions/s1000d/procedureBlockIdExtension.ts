import { Extension } from "@tiptap/core";

import { PROCEDURE_NATIVE_BLOCK_ID_TYPES } from "../../lib/s1000d/procedureInspectableTypes";
import { s1000dIdAttributeConfig } from "../../lib/s1000d/s1000dIdAttribute";
import { SOURCE_XML_ATTR_KEYS } from "../../lib/s1000d/sourceXmlAttrKeys";

/**
 * 为程序类 `<content>/<procedure>` 内块节点统一挂 `id` 与 `sourceXmlAttrKeys`。
 * Phase1 节点（`para` / `figure` 等）仍使用各自 `addAttributes`。
 */
export const ProcedureBlockIdExtension = Extension.create({
  name: "procedureBlockId",

  addGlobalAttributes() {
    return [
      {
        types: [...PROCEDURE_NATIVE_BLOCK_ID_TYPES],
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
