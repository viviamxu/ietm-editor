import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import {
  collectIllegalLooseParaRanges,
  containerAllowsLooseParaChild,
  countIllegalLooseParas,
  deleteIllegalLooseParaRanges,
  isIllegalTextCursorPos,
  resolveBlockNodeSelectionBeforePos,
} from "../../lib/s1000d/schemaContentRuleValidate";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

const schemaContentGuardKey = new PluginKey("s1000dSchemaContentGuard");

function clampSelectionAfterDelete(tr: Transaction): void {
  const { selection } = tr;
  if (!(selection instanceof TextSelection)) return;
  const size = tr.doc.content.size;
  const from = Math.min(Math.max(0, selection.from), size);
  const to = Math.min(Math.max(0, selection.to), size);
  if (from === selection.from && to === selection.to) return;
  tr.setSelection(TextSelection.create(tr.doc, from, to));
}

function redirectIllegalTextCursorClick(
  view: EditorView,
  clickPos: number,
): boolean {
  const doc = view.state.doc;
  const fallbackPos = resolveBlockNodeSelectionBeforePos(doc, clickPos);
  if (fallbackPos != null) {
    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(doc, fallbackPos)),
    );
    return true;
  }
  view.dom.blur();
  return true;
}

function handleIllegalTextCursorPointer(
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (event.button !== 0 || !view.editable) return false;

  const schema = getDescriptionSchema();
  const coords = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });

  if (coords) {
    const $pos = view.state.doc.resolve(coords.pos);
    if (!isIllegalTextCursorPos($pos, schema)) return false;
    event.preventDefault();
    return redirectIllegalTextCursorClick(view, coords.pos);
  }

  if (!containerAllowsLooseParaChild("doc", schema)) {
    event.preventDefault();
    view.dom.blur();
    return true;
  }

  return false;
}

/**
 * 按 DescriptionSchema 的 `content` 规则移除非法 loose `para` / `paragraph`
 *（如图解/程序/故障类 `doc` 根下的游离段落）。
 */
export const S1000DSchemaContentGuardExtension = Extension.create({
  name: "s1000dSchemaContentGuard",
  priority: 1040,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: schemaContentGuardKey,
        filterTransaction(tr, state) {
          const schema = getDescriptionSchema();

          if (tr.docChanged) {
            const before = countIllegalLooseParas(state.doc, schema);
            const after = countIllegalLooseParas(tr.doc, schema);
            if (after > before) return false;
          }

          if (tr.selectionSet && tr.selection instanceof TextSelection) {
            if (isIllegalTextCursorPos(tr.selection.$from, schema)) {
              return false;
            }
            if (
              !tr.selection.empty &&
              isIllegalTextCursorPos(tr.selection.$to, schema)
            ) {
              return false;
            }
          }

          return true;
        },
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (!(event instanceof MouseEvent)) return false;
              return handleIllegalTextCursorPointer(view, event);
            },
          },
          handleClick(view, pos, event) {
            const schema = getDescriptionSchema();
            const $pos = view.state.doc.resolve(pos);
            if (!isIllegalTextCursorPos($pos, schema)) return false;
            event.preventDefault();
            return redirectIllegalTextCursorClick(view, pos);
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const schema = getDescriptionSchema();
          const ranges = collectIllegalLooseParaRanges(newState.doc, schema);
          if (ranges.length === 0) return null;

          const tr = newState.tr;
          if (!deleteIllegalLooseParaRanges(tr, ranges)) return null;
          clampSelectionAfterDelete(tr);
          return tr;
        },
      }),
    ];
  },
});
