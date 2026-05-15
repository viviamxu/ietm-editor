import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

const FLASH_MS = 1000;
const FLASH_CLASS = "s1000d-internal-ref-target-flash";

/** 内部引用跳转后的下一次选区变化不自动展开属性面板 */
let suppressNextPropertyPanelOpen = false;

/** 跳转后短暂忽略编辑器上的 mousedown，防止 Popover 关闭时 click 穿透误选 internalRef */
let jumpGuardUntil = 0;

const JUMP_GUARD_MS = 400;

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

function armInternalRefJumpGuard(): void {
  jumpGuardUntil = Date.now() + JUMP_GUARD_MS;
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

export function flashRefTargetInDom(editor: Editor, refId: string): void {
  const root = editor.view.dom as HTMLElement;
  const trimmed = refId.trim();
  if (!trimmed) return;

  let target: HTMLElement | null = null;
  try {
    target = root.querySelector(
      `[id="${CSS.escape(trimmed)}"]`,
    ) as HTMLElement | null;
  } catch {
    for (const el of Array.from(root.querySelectorAll("[id]"))) {
      if (el instanceof HTMLElement && el.id === trimmed) {
        target = el;
        break;
      }
    }
  }
  if (!target) return;
  try {
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch {
    target.scrollIntoView();
  }
  target.classList.add(FLASH_CLASS);
  window.setTimeout(() => target?.classList.remove(FLASH_CLASS), FLASH_MS);
}

/**
 * 定位到引用目标：NodeSelection 整块蓝色选中 + 滚动 + DOM 闪烁；不触发 internalRef 属性面板。
 */
export function navigateInternalRefTarget(editor: Editor, refId: string): void {
  const trimmed = refId.trim();
  if (!trimmed) return;

  const meta = findInternalRefTargetById(editor, trimmed);
  if (meta === null) return;

  const targetNode = editor.state.doc.nodeAt(meta.pos);
  if (!targetNode) return;

  armInternalRefJumpGuard();
  suppressNextPropertyPanelOpen = true;

  const tr = editor.state.tr
    .setSelection(NodeSelection.create(editor.state.doc, meta.pos))
    .scrollIntoView();

  editor.view.dispatch(tr);
  editor.view.focus();

  requestAnimationFrame(() => flashRefTargetInDom(editor, trimmed));
}
