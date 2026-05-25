import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import {
  getDefaultTitleForIsolationBlock,
  getTitleTextFromNode,
} from "../../lib/s1000d/faultIsolationDefaultTitles";

const faultIsolationTitleBlurKey = new PluginKey("faultIsolationTitleBlur");

function isFaultIsolationTitleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        ".s1000d-isolation-step__content .s1000d-title-display",
        ".s1000d-isolation-step__content s1000d-block-title",
        ".s1000d-isolation-end__content .s1000d-title-display",
        ".s1000d-isolation-end__content s1000d-block-title",
      ].join(", "),
    ),
  );
}

function restoreEmptyTitleOnBlur(
  view: import("@tiptap/pm/view").EditorView,
  event: FocusEvent,
): boolean {
  const target = event.target;
  if (!isFaultIsolationTitleTarget(target)) return false;

  const { state } = view;
  let titlePos: number | null = null;
  let titleNode: import("@tiptap/pm/model").Node | null = null;
  let blockPos: number | null = null;
  let blockType: "isolationStep" | "isolationProcedureEnd" | null = null;

  try {
    const domPos = view.posAtDOM(target as Node, 0);
    const $pos = state.doc.resolve(domPos);
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === "title" && titlePos == null) {
        titlePos = $pos.before(d);
        titleNode = node;
      }
      if (
        node.type.name === "isolationStep" ||
        node.type.name === "isolationProcedureEnd"
      ) {
        blockPos = $pos.before(d);
        blockType = node.type.name as "isolationStep" | "isolationProcedureEnd";
        break;
      }
    }
  } catch {
    return false;
  }

  if (titlePos == null || !titleNode || blockPos == null || !blockType) {
    return false;
  }
  if (getTitleTextFromNode(titleNode)) return false;

  const defaultLabel = getDefaultTitleForIsolationBlock(
    state.doc,
    blockPos,
    blockType,
  );
  const from = titlePos + 1;
  const to = titlePos + titleNode.nodeSize - 1;
  const tr = state.tr.replaceWith(from, to, state.schema.text(defaultLabel));
  view.dispatch(tr);
  return false;
}

/** 故障隔离：步骤/结束 `title` 失焦且为空时恢复默认标题名。 */
export const FaultIsolationTitleExtension = Extension.create({
  name: "faultIsolationTitleBlur",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: faultIsolationTitleBlurKey,
        props: {
          handleDOMEvents: {
            blur: (view, event) => restoreEmptyTitleOnBlur(view, event),
          },
        },
      }),
    ];
  },
});
