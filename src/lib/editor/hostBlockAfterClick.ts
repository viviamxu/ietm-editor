import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

import {
  FMFT_PARA_CONTAINER_TYPES,
  HOST_BLOCK_TYPES_NEEDING_PARA_AFTER,
  insertParaAfterHostBlock,
} from "./insertParaAfterFmftBlock";

/** 宿主块根 DOM：与 NodeView 外壳 class 一致。 */
const HOST_BLOCK_ROOT_SELECTOR =
  "aside.s1000d-attention-block, .s1000d-table-wrap, figure.s1000d-figure, .s1000d-multimedia-node";

/** 块底缘下方可点击落光标的区域高度（px）。 */
const CLICK_BELOW_BLOCK_PX = 28;

function isHostBlockType(typeName: string): boolean {
  return HOST_BLOCK_TYPES_NEEDING_PARA_AFTER.has(typeName);
}

function childPos(parentPos: number, parent: PMNode, childIndex: number): number {
  let pos = parentPos + 1;
  for (let i = 0; i < childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

/** 点击是否落在宿主块内部可编辑区域（表格单元格、warning 正文等）。 */
export function isHostBlockEditableInterior(target: Element): boolean {
  if (target.closest("td, th")) return true;
  if (
    target.closest(
      ".s1000d-attention-lead__text, .s1000d-attention-block__body-item__content, .s1000d-note-lead__text",
    )
  ) {
    return true;
  }
  if (target.closest("button, [role='button'], input, textarea, select")) {
    return true;
  }
  return false;
}

function resolveHostBlockFromDom(
  view: EditorView,
  hostEl: Element,
): { pos: number; node: PMNode } | null {
  try {
    const rawPos = view.posAtDOM(hostEl, 0);
    const $pos = view.state.doc.resolve(rawPos);
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (isHostBlockType(node.type.name)) {
        return { pos: $pos.before(d), node };
      }
    }
    const at = view.state.doc.nodeAt(rawPos);
    if (at && isHostBlockType(at.type.name)) {
      return { pos: rawPos, node: at };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function resolveHostBlockBeforeParaEl(
  view: EditorView,
  paraEl: Element,
): { pos: number; node: PMNode } | null {
  try {
    const paraPos = view.posAtDOM(paraEl, 0);
    const $para = view.state.doc.resolve(paraPos);
    for (let d = $para.depth; d > 0; d--) {
      const parent = $para.node(d);
      if (!FMFT_PARA_CONTAINER_TYPES.has(parent.type.name)) continue;
      const index = $para.index(d);
      if (index === 0) return null;
      const prev = parent.child(index - 1);
      if (!isHostBlockType(prev.type.name)) return null;
      return {
        pos: childPos($para.before(d), parent, index - 1),
        node: prev,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function hostBlockFromCoords(
  view: EditorView,
  clientX: number,
  clientY: number,
): { pos: number; node: PMNode } | null {
  const hostEls = view.dom.querySelectorAll(HOST_BLOCK_ROOT_SELECTOR);
  for (const hostEl of hostEls) {
    const rect = hostEl.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right) continue;
    if (clientY < rect.bottom - 2 || clientY > rect.bottom + CLICK_BELOW_BLOCK_PX) {
      continue;
    }
    const found = resolveHostBlockFromDom(view, hostEl);
    if (found) return found;
  }
  return null;
}

/**
 * 在 warning / 表格 / 图片等宿主块后点击：插入或聚焦 trailing `para`（Word/WPS 式落光标）。
 */
export function handleHostBlockAfterClick(
  editor: Editor,
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (!editor.isEditable || event.button !== 0) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (isHostBlockEditableInterior(target)) return false;

  let found: { pos: number; node: PMNode } | null = null;

  const paraEl = target.closest("para");
  if (paraEl) {
    const hostBefore = resolveHostBlockBeforeParaEl(view, paraEl);
    if (hostBefore) {
      const text = paraEl.textContent?.trim() ?? "";
      if (text.length > 0) return false;
      found = hostBefore;
    }
  }

  if (!found) {
    const hostEl = target.closest(HOST_BLOCK_ROOT_SELECTOR);
    if (hostEl && !isHostBlockEditableInterior(target)) {
      const rect = hostEl.getBoundingClientRect();
      if (event.clientY >= rect.bottom - 12) {
        found = resolveHostBlockFromDom(view, hostEl);
      }
    }
  }

  if (!found) {
    found = hostBlockFromCoords(view, event.clientX, event.clientY);
  }

  if (!found) return false;

  event.preventDefault();
  return insertParaAfterHostBlock(editor, found.pos, found.node);
}
