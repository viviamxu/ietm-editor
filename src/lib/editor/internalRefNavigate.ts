import type { Editor } from "@tiptap/core";

import { PROCEDURE_TABLE_ROW_NODE_TYPES } from "../s1000d/procedureTableRowDom";

const FLASH_MS = 1000;
const OVERLAY_CLASS = "s1000d-internal-ref-target-flash-overlay";

const FLASH_TARGET_SELECTOR =
  "section[data-s1000d-node], para, levelledpara, figure, warning, caution, note, table, [data-s1000d-xml-table]";

/** 内部引用跳转后的下一次选区变化不自动展开属性面板 */
let suppressNextPropertyPanelOpen = false;

/** 跳转后短暂忽略编辑器上的 mousedown，防止 Popover 关闭时 click 穿透误选 internalRef */
let jumpGuardUntil = 0;

const JUMP_GUARD_MS = 400;

let activeFlashOverlay: HTMLElement | null = null;
let activeFlashOverlayTimer: ReturnType<typeof setTimeout> | null = null;

export type InternalRefTargetMeta = {
  pos: number;
  typeName: string;
};

/** 跳转触发的选区变化期间应保持属性面板关闭（可多次查询，直至 consume） */
export function peekSuppressPropertyPanelOpen(): boolean {
  return suppressNextPropertyPanelOpen;
}

export function consumeSuppressPropertyPanelOpen(): boolean {
  const v = suppressNextPropertyPanelOpen;
  suppressNextPropertyPanelOpen = false;
  return v;
}

/** 为 true 时 ProseMirror 应忽略本次 mousedown（见 IETMEditor editorProps） */
export function consumeInternalRefJumpGuard(): boolean {
  if (Date.now() >= jumpGuardUntil) return false;
  jumpGuardUntil = 0;
  return true;
}

/** Popover 内点击跳转/打开时，避免指针事件穿透正文（内部/外部引用共用）。 */
export function armInternalRefJumpGuard(): void {
  jumpGuardUntil = Date.now() + JUMP_GUARD_MS;
}

function removeActiveFlashOverlay(): void {
  if (activeFlashOverlayTimer != null) {
    window.clearTimeout(activeFlashOverlayTimer);
    activeFlashOverlayTimer = null;
  }
  activeFlashOverlay?.remove();
  activeFlashOverlay = null;
}

/**
 * 在当前文档内按 `id` 属性查找可被内部引用指向的节点。
 */
export function findInternalRefTargetById(
  editor: Editor,
  refId: string,
): InternalRefTargetMeta | null {
  const trimmed = refId.trim();
  if (!trimmed) return null;

  let found: InternalRefTargetMeta | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "internalRef") return;
    if (!("id" in (node.type.spec.attrs ?? {}))) return;

    const raw = node.attrs.id;
    const idAttr =
      typeof raw === "string"
        ? raw.trim()
        : raw != null
          ? String(raw).trim()
          : "";
    if (!idAttr || idAttr !== trimmed) return;

    found = { pos, typeName: node.type.name };
    return false;
  });
  return found;
}

/** @deprecated 使用 {@link findInternalRefTargetById} */
export function findDocPosByElementId(
  editor: Editor,
  refId: string,
): number | null {
  return findInternalRefTargetById(editor, refId)?.pos ?? null;
}

function pickFlashHost(el: HTMLElement): HTMLElement {
  if (
    el.hasAttribute("data-s1000d-element-id") ||
    el.hasAttribute("id") ||
    el.hasAttribute("data-s1000d-node")
  ) {
    return el;
  }
  const block = el.closest(FLASH_TARGET_SELECTOR);
  return block instanceof HTMLElement ? block : el;
}

/** 解析节点在文档中的「紧贴节点前」位置，供 nodeDOM / coords 使用。 */
function resolveDomPosForMeta(
  editor: Editor,
  meta: InternalRefTargetMeta,
): number {
  const doc = editor.state.doc;
  try {
    const $pos = doc.resolve(meta.pos);
    if ($pos.nodeAfter?.type.name === meta.typeName) return meta.pos;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === meta.typeName) {
        return $pos.before(d);
      }
    }
  } catch {
    /* use meta.pos */
  }
  return meta.pos;
}

function domElementAtNodePos(editor: Editor, domPos: number): HTMLElement | null {
  const direct = editor.view.nodeDOM(domPos);
  if (direct instanceof HTMLElement) return direct;
  if (direct?.parentElement instanceof HTMLElement) return direct.parentElement;

  try {
    const domAt = editor.view.domAtPos(domPos + 1);
    const node = domAt.node;
    if (node instanceof HTMLElement) return node;
    if (node.parentElement instanceof HTMLElement) return node.parentElement;
  } catch {
    /* ignore */
  }
  return null;
}

function queryTargetByRefId(
  root: HTMLElement,
  trimmed: string,
): HTMLElement | null {
  try {
    const byData = root.querySelector(
      `[data-s1000d-element-id="${CSS.escape(trimmed)}"]`,
    );
    if (byData instanceof HTMLElement) return byData;
  } catch {
    for (const el of Array.from(
      root.querySelectorAll("[data-s1000d-element-id]"),
    )) {
      if (
        el instanceof HTMLElement &&
        el.getAttribute("data-s1000d-element-id") === trimmed
      ) {
        return el;
      }
    }
  }

  try {
    const byId = root.querySelector(`[id="${CSS.escape(trimmed)}"]`);
    if (byId instanceof HTMLElement) return byId;
  } catch {
    for (const el of Array.from(root.querySelectorAll("[id]"))) {
      if (el instanceof HTMLElement && el.id === trimmed) return el;
    }
  }

  return null;
}

/** 程序类表格：按文档位置定位可见 `<tr>`（优先于隐藏 PM 宿主）。 */
function queryProcedureTableRowByDocPos(
  root: HTMLElement,
  docPos: number,
): HTMLElement | null {
  try {
    const row = root.querySelector(
      `tr[data-s1000d-doc-pos="${CSS.escape(String(docPos))}"]`,
    );
    if (row instanceof HTMLElement) return row;
  } catch {
    for (const row of Array.from(
      root.querySelectorAll("tr[data-s1000d-doc-pos]"),
    )) {
      if (
        row instanceof HTMLElement &&
        row.getAttribute("data-s1000d-doc-pos") === String(docPos)
      ) {
        return row;
      }
    }
  }
  return null;
}

function resolveRefTargetElement(
  editor: Editor,
  trimmed: string,
  meta: InternalRefTargetMeta,
): HTMLElement | null {
  const root = editor.view.dom as HTMLElement;
  const domPos = resolveDomPosForMeta(editor, meta);

  if (PROCEDURE_TABLE_ROW_NODE_TYPES.has(meta.typeName)) {
    const tableRow = queryProcedureTableRowByDocPos(root, domPos);
    if (tableRow) return tableRow;
  }

  const byAttr = queryTargetByRefId(root, trimmed);
  if (byAttr) {
    const visibleRow = byAttr.closest("tr.s1000d-procedure-table-row");
    if (visibleRow instanceof HTMLElement) return visibleRow;
    return pickFlashHost(byAttr);
  }

  const fromPos = domElementAtNodePos(editor, domPos);
  if (fromPos) {
    const visibleRow = fromPos.closest("tr[data-s1000d-doc-pos]");
    if (visibleRow instanceof HTMLElement) return visibleRow;
    return pickFlashHost(fromPos);
  }

  return null;
}

function getFlashMount(editor: Editor): HTMLElement | null {
  return (
    (editor.view.dom.closest(".ietm-editor-pane") as HTMLElement | null) ??
    (editor.view.dom.parentElement as HTMLElement | null)
  );
}

/**
 * 在编辑区滚动容器上叠加高亮层（不修改目标节点 DOM，避免 ProseMirror 重绘抹掉样式）。
 */
function showFlashOverlay(editor: Editor, target: HTMLElement): void {
  const mount = getFlashMount(editor);
  if (!mount) return;

  removeActiveFlashOverlay();

  const mountRect = mount.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.left = `${targetRect.left - mountRect.left + mount.scrollLeft}px`;
  overlay.style.top = `${targetRect.top - mountRect.top + mount.scrollTop}px`;
  overlay.style.width = `${Math.max(targetRect.width, 4)}px`;
  overlay.style.height = `${Math.max(targetRect.height, 4)}px`;

  mount.appendChild(overlay);
  activeFlashOverlay = overlay;
  activeFlashOverlayTimer = window.setTimeout(
    () => removeActiveFlashOverlay(),
    FLASH_MS,
  );
}

export function flashRefTargetInDom(
  editor: Editor,
  refId: string,
  meta?: InternalRefTargetMeta | null,
): void {
  const trimmed = refId.trim();
  if (!trimmed) return;

  const resolved = meta ?? findInternalRefTargetById(editor, trimmed);
  if (!resolved) return;

  const target = resolveRefTargetElement(editor, trimmed, resolved);
  if (!target) return;

  try {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    target.scrollIntoView();
  }

  showFlashOverlay(editor, target);
}

/**
 * 定位到引用目标：滚动至可见区域 + 叠加层高亮 1 秒（不改变选区）。
 */
export function navigateInternalRefTarget(editor: Editor, refId: string): void {
  const trimmed = refId.trim();
  if (!trimmed) return;

  const meta = findInternalRefTargetById(editor, trimmed);
  if (meta === null) return;

  const domPos = resolveDomPosForMeta(editor, meta);
  try {
    const $pos = editor.state.doc.resolve(domPos);
    if ($pos.nodeAfter?.type.name !== meta.typeName) return;
  } catch {
    return;
  }

  armInternalRefJumpGuard();
  suppressNextPropertyPanelOpen = true;

  editor.view.focus();

  const runFlash = () => flashRefTargetInDom(editor, trimmed, meta);

  requestAnimationFrame(() => {
    requestAnimationFrame(runFlash);
    // smooth scroll 结束后再对齐一次 overlay 位置
    window.setTimeout(runFlash, 320);
  });
}
