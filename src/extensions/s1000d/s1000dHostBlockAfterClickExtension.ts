import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { handleHostBlockAfterClick } from "../../lib/editor/hostBlockAfterClick";

const hostBlockAfterClickPluginKey = new PluginKey("s1000dHostBlockAfterClick");

/**
 * 描述类 / 程序类：在 `table` / `figure` / `multimedia` / `warning` / `caution` / `note`
 * 下方点击时插入或聚焦 trailing `para`，便于继续输入正文。
 */
export const S1000DHostBlockAfterClickExtension = Extension.create({
  name: "s1000dHostBlockAfterClick",
  priority: 1010,

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: hostBlockAfterClickPluginKey,
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (!(event instanceof MouseEvent)) return false;
              return handleHostBlockAfterClick(editor, view, event);
            },
          },
        },
      }),
    ];
  },
});
