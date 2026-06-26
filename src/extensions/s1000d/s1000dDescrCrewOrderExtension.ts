import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { createPluginComposingGuard } from "../../lib/editor/imeComposition";
import { normalizeDescrCrewOrderInTransaction } from "../../lib/s1000d/descrCrewLayout";

const descrCrewOrderKey = new PluginKey("s1000dDescrCrewOrder");

/** `descrCrew` 直系子节点按 warning* → caution* → note* → levelledPara* 归位。 */
export const S1000DDescrCrewOrderExtension = Extension.create({
  name: "s1000dDescrCrewOrder",
  priority: 1035,

  addProseMirrorPlugins() {
    const composingGuard = createPluginComposingGuard();
    return [
      new Plugin({
        key: descrCrewOrderKey,
        appendTransaction(transactions, _oldState, newState) {
          if (composingGuard.isComposing()) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const tr = newState.tr;
          if (!normalizeDescrCrewOrderInTransaction(tr)) return null;
          return tr;
        },
        view(editorView) {
          return composingGuard.bindView(editorView);
        },
      }),
    ];
  },
});
