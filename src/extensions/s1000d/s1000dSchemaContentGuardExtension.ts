import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { collectIllegalSchemaContentRanges } from "../../lib/s1000d/schemaContentRuleValidate";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

const schemaContentGuardKey = new PluginKey("s1000dSchemaContentGuard");

/**
 * 按 DescriptionSchema 的 `content` 规则移除非法块（如图解/程序/故障类 `doc` 下的 loose `para`）。
 */
export const S1000DSchemaContentGuardExtension = Extension.create({
  name: "s1000dSchemaContentGuard",
  priority: 1040,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: schemaContentGuardKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const schema = getDescriptionSchema();
          const ranges = collectIllegalSchemaContentRanges(
            newState.doc,
            schema,
          );
          if (ranges.length === 0) return null;

          let tr = newState.tr;
          for (let i = ranges.length - 1; i >= 0; i--) {
            tr.delete(ranges[i].from, ranges[i].to);
          }
          return tr;
        },
      }),
    ];
  },
});
