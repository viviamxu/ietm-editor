/**
 * 将 ProseMirror / Tiptap 事务推迟到当前 React 更新周期之外执行，
 * 避免 NodeView 在 lifecycle 内触发 flushSync 警告。
 */
export function deferEditorMutation(run: () => void): void {
  queueMicrotask(run);
}
