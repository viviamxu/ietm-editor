import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";

/** 最近一次处于 IME 组合态的 EditorView（单编辑器场景足够）。 */
let activeComposingView: EditorView | null = null;
const composingViewFlags = new WeakMap<EditorView, boolean>();

/** 组合区在文档中的范围（半开区间 [from, to)）。 */
type CompositionDocRange = { from: number; to: number };

let compositionDocRange: CompositionDocRange | null = null;

const imeCompositionPluginKey = new PluginKey("imeComposition");

function readSliceText(slice: ReplaceStep["slice"]): string {
  let out = "";
  slice.content.forEach((node) => {
    if (node.isText) out += node.text ?? "";
  });
  return out;
}

function syncCompositionDocRangeFromSelection(view: EditorView): void {
  const { from, to } = view.state.selection;
  compositionDocRange = { from, to: Math.max(from, to) };
}

function clearCompositionDocRange(view: EditorView): void {
  compositionDocRange = null;
  if (activeComposingView === view) {
    activeComposingView = null;
  }
  composingViewFlags.delete(view);
}

function markViewComposing(view: EditorView, active: boolean): void {
  composingViewFlags.set(view, active);
  activeComposingView = active ? view : null;
  if (active) {
    syncCompositionDocRangeFromSelection(view);
  } else {
    compositionDocRange = null;
  }
}

/** 是否处于 IME 组合输入（拼音未确认）阶段。 */
export function isEditorComposing(editor: Editor): boolean {
  const view = editor.view;
  if (view.isDestroyed) return false;
  return isEditorViewComposing(view);
}

export function isEditorViewComposing(view: EditorView | null | undefined): boolean {
  if (view == null || view.isDestroyed) return false;
  if (view.composing) return true;
  return composingViewFlags.get(view) === true;
}

/** 供 NodeView `update` 等无 editor 引用处使用。 */
export function isImeComposingActive(): boolean {
  if (activeComposingView && !activeComposingView.isDestroyed) {
    return isEditorViewComposing(activeComposingView);
  }
  return false;
}

/**
 * 组合期间 PM 偶发在 compEnd 纯插入（#4），导致 sh+shi→shshi。
 * 将错误追加改写为对组合区的整体替换。
 */
function fixCompositionAppendDuplicate(
  oldState: EditorView["state"],
  newState: EditorView["state"],
  comp: CompositionDocRange,
  insertedText: string,
  insertPos: number,
) {
  if (!insertedText) return null;

  const oldText = oldState.doc.textBetween(comp.from, comp.to, "", "");
  const fixTo = insertPos + insertedText.length;
  const actualText = newState.doc.textBetween(comp.from, fixTo, "", "");

  if (actualText !== oldText + insertedText) return null;

  const textNode = newState.schema.text(insertedText);
  return newState.tr.replaceWith(comp.from, fixTo, textNode);
}

function updateCompositionDocRangeAfterReplace(
  comp: CompositionDocRange,
  from: number,
  to: number,
  insertedText: string,
): CompositionDocRange {
  if (insertedText.length === 0 && to > from) {
    return { from: Math.min(comp.from, from), to: from };
  }
  if (from === to && insertedText.length > 0) {
    if (from === comp.to || from === comp.from) {
      return { from: comp.from, to: from + insertedText.length };
    }
  }
  if (from <= comp.from && to >= comp.to && insertedText.length > 0) {
    return { from, to: from + insertedText.length };
  }
  if (from === comp.from && to > comp.from) {
    return { from, to };
  }
  return comp;
}

/**
 * 高优先级扩展：跟踪 composition 范围，修正组合区错位追加。
 */
export const ImeCompositionExtension = Extension.create({
  name: "imeComposition",
  priority: 10000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: imeCompositionPluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (!isEditorViewComposing(activeComposingView)) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const comp = compositionDocRange;
          if (!comp) return null;

          let currentComp = comp;

          for (const tr of transactions) {
            for (const step of tr.steps) {
              if (!(step instanceof ReplaceStep)) continue;

              const { from, to, slice } = step;
              const insertedText = readSliceText(slice);

              if (
                from === to &&
                from === currentComp.to &&
                insertedText.length > 0
              ) {
                const fixTr = fixCompositionAppendDuplicate(
                  oldState,
                  newState,
                  currentComp,
                  insertedText,
                  from,
                );
                if (fixTr) {
                  compositionDocRange = {
                    from: currentComp.from,
                    to: currentComp.from + insertedText.length,
                  };
                  return fixTr;
                }
              }

              currentComp = updateCompositionDocRangeAfterReplace(
                currentComp,
                from,
                to,
                insertedText,
              );
              compositionDocRange = currentComp;
            }
          }

          return null;
        },
        props: {
          handleDOMEvents: {
            beforeinput(view, event) {
              if (!(event instanceof InputEvent)) return false;
              const t = event.inputType;
              // 仅 IME 组合输入标记 composing；普通 insertText 无 compositionend，会误拦序号等 appendTransaction。
              if (t.startsWith("insertComposition")) {
                markViewComposing(view, true);
              }
              return false;
            },
            compositionstart(view) {
              markViewComposing(view, true);
              return false;
            },
            compositionupdate(view) {
              markViewComposing(view, true);
              syncCompositionDocRangeFromSelection(view);
              return false;
            },
            compositionend(view) {
              markViewComposing(view, false);
              return false;
            },
          },
        },
        view(view) {
          return {
            destroy() {
              clearCompositionDocRange(view);
            },
          };
        },
      }),
    ];
  },
});

/**
 * 供带 `appendTransaction` 的 ProseMirror 插件使用：在 `view()` 中绑定后可读取 `composing`。
 */
export function createPluginComposingGuard() {
  let editorView: EditorView | null = null;

  return {
    isComposing(): boolean {
      return isEditorViewComposing(editorView);
    },
    bindView(view: EditorView, existing?: { destroy?: () => void }) {
      editorView = view;
      const prevDestroy = existing?.destroy;
      return {
        destroy() {
          editorView = null;
          prevDestroy?.();
        },
      };
    },
  };
}
