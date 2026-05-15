import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

const FLASH_MS = 1000
const FLASH_CLASS = 's1000d-internal-ref-target-flash'

export type InternalRefTargetMeta = {
  pos: number;
  typeName: string;
};

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
  const root = editor.view.dom as HTMLElement
  const trimmed = refId.trim()
  if (!trimmed) return

  let target: HTMLElement | null = null
  try {
    target = root.querySelector(`[id="${CSS.escape(trimmed)}"]`) as HTMLElement | null
  } catch {
    for (const el of Array.from(root.querySelectorAll("[id]"))) {
      if (el instanceof HTMLElement && el.id === trimmed) {
        target = el
        break
      }
    }
  }
  if (!target) return
  try {
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch {
    target.scrollIntoView()
  }
  target.classList.add(FLASH_CLASS)
  window.setTimeout(() => target?.classList.remove(FLASH_CLASS), FLASH_MS)
}

/**
 * NodeSelection 定位目标块，再在 DOM 上闪烁提示约 1 秒。
 */
export function navigateInternalRefTarget(editor: Editor, refId: string): void {
  const trimmed = refId.trim()
  if (!trimmed) return

  const meta = findInternalRefTargetById(editor, trimmed)
  if (meta === null) {
    editor.chain().focus().run()
    return
  }

  const tr = editor.state.tr
    .setSelection(NodeSelection.create(editor.state.doc, meta.pos))
    .scrollIntoView()

  editor.view.dispatch(tr)

  requestAnimationFrame(() => flashRefTargetInDom(editor, trimmed))
}
