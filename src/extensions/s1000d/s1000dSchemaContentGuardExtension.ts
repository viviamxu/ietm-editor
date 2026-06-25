import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
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
import { createPluginComposingGuard } from "../../lib/editor/imeComposition";

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
  const $click = doc.resolve(clickPos);

  const nearText = TextSelection.near($click, 1);
  if (nearText.$from.parent.inlineContent) {
    view.dispatch(view.state.tr.setSelection(nearText));
    view.focus();
    return true;
  }

  const fallbackPos = resolveBlockNodeSelectionBeforePos(doc, clickPos);
  if (fallbackPos != null) {
    const $pos = doc.resolve(fallbackPos);
    const node = $pos.nodeAfter;
    if (node?.isTextblock) {
      const inner = TextSelection.create(doc, fallbackPos + 1);
      view.dispatch(view.state.tr.setSelection(inner));
      view.focus();
      return true;
    }
    if (node && NodeSelection.isSelectable(node)) {
      view.dispatch(view.state.tr.setSelection(new NodeSelection($pos)));
      view.focus();
      return true;
    }
  }

  const fallback = Selection.near($click, 1);
  if (fallback instanceof TextSelection && fallback.$from.parent.inlineContent) {
    view.dispatch(view.state.tr.setSelection(fallback));
    view.focus();
    return true;
  }

  return false;
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

  if (!containerAllowsLooseParaChild("doc", schema, view.state.doc)) {
    event.preventDefault();
    return redirectIllegalTextCursorClick(view, view.state.selection.from);
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
    const composingGuard = createPluginComposingGuard();
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
          if (composingGuard.isComposing()) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const schema = getDescriptionSchema();
          const ranges = collectIllegalLooseParaRanges(newState.doc, schema);
          if (ranges.length === 0) return null;

          const tr = newState.tr;
          if (!deleteIllegalLooseParaRanges(tr, ranges)) return null;
          clampSelectionAfterDelete(tr);
          return tr;
        },
        view(editorView) {
          return composingGuard.bindView(editorView);
        },
      }),
    ];
  },
});
