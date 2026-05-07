import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { JSONContent } from '@tiptap/core'
import {
  IETMEditorRoot,
  type IETMEditorRootHandle,
} from './react/IETMEditorRoot'
import type { ApplicabilityState } from './react/context/ApplicabilityContext'
import type { InsertTableOptions } from './react/IETMEditor'
import './style.css'

export type { JSONContent } from '@tiptap/core'
export type { ApplicabilityState } from './react/context/ApplicabilityContext'
export type { InsertTableOptions } from './react/IETMEditor'

export interface IETMEditorOptions {
  element: HTMLElement
  content?: JSONContent | string
  applicability?: ApplicabilityState
  editable?: boolean
}

export interface IETMEditorEvents {
  update: { json: JSONContent }
  selectionChange: { from: number; to: number }
  ready: void
}

export type IETMEditorEventName = keyof IETMEditorEvents

export type IETMEditorEventHandler<E extends IETMEditorEventName> = (
  payload: IETMEditorEvents[E],
) => void

export interface IETMEditorInstance {
  setContent(content: JSONContent | string): void
  setApplicability(next: Partial<ApplicabilityState>): void
  setEditable(value: boolean): void
  getJSON(): JSONContent
  focus(): void
  /** 光标处插入表格；默认 3×3 且带表头。须在编辑器就绪后调用，否则返回 false。 */
  insertTable(options?: InsertTableOptions): boolean
  /** 相对当前单元格在其上方插入一行；失败（如不在表格内）时返回 false。 */
  addTableRowBefore(): boolean
  /** 相对当前单元格在其下方插入一行。 */
  addTableRowAfter(): boolean
  /** 相对当前单元格在其左侧插入一列。 */
  addTableColumnBefore(): boolean
  /** 相对当前单元格在其右侧插入一列。 */
  addTableColumnAfter(): boolean
  on<E extends IETMEditorEventName>(
    event: E,
    handler: IETMEditorEventHandler<E>,
  ): () => void
  off<E extends IETMEditorEventName>(
    event: E,
    handler: IETMEditorEventHandler<E>,
  ): void
  destroy(): void
}

type EmitterMap = {
  [E in IETMEditorEventName]: Set<IETMEditorEventHandler<E>>
}

function createEmitter(): {
  on: IETMEditorInstance['on']
  off: IETMEditorInstance['off']
  emit: <E extends IETMEditorEventName>(
    event: E,
    payload: IETMEditorEvents[E],
  ) => void
  clear: () => void
} {
  const map: EmitterMap = {
    update: new Set(),
    selectionChange: new Set(),
    ready: new Set(),
  }
  return {
    on(event, handler) {
      ;(map[event] as Set<typeof handler>).add(handler)
      return () => {
        ;(map[event] as Set<typeof handler>).delete(handler)
      }
    },
    off(event, handler) {
      ;(map[event] as Set<typeof handler>).delete(handler)
    },
    emit(event, payload) {
      const set = map[event] as Set<IETMEditorEventHandler<typeof event>>
      set.forEach((handler) => handler(payload))
    },
    clear() {
      ;(Object.keys(map) as IETMEditorEventName[]).forEach((key) => {
        map[key].clear()
      })
    },
  }
}

export function createIETMEditor(
  options: IETMEditorOptions,
): IETMEditorInstance {
  if (!options.element) {
    throw new Error('[ietm-editor] options.element is required')
  }

  let disposed = false
  const root: Root = createRoot(options.element)
  const emitter = createEmitter()

  const handleRef: { current: IETMEditorRootHandle | null } = { current: null }
  const pending: Array<(handle: IETMEditorRootHandle) => void> = []

  const withHandle = (fn: (handle: IETMEditorRootHandle) => void) => {
    if (disposed) return
    if (handleRef.current) {
      fn(handleRef.current)
      return
    }
    pending.push(fn)
  }

  const setHandle = (handle: IETMEditorRootHandle | null) => {
    handleRef.current = handle
    if (handle) {
      const queue = pending.splice(0, pending.length)
      queue.forEach((fn) => fn(handle))
    }
  }

  root.render(
    createElement(IETMEditorRoot, {
      ref: setHandle,
      initialContent: options.content,
      initialApplicability: options.applicability,
      initialEditable: options.editable ?? true,
      onUpdate: (json) => emitter.emit('update', { json }),
      onSelectionChange: (range) => emitter.emit('selectionChange', range),
      onReady: () => emitter.emit('ready', undefined),
    }),
  )

  return {
    setContent: (content) => withHandle((h) => h.setContent(content)),
    setApplicability: (next) => withHandle((h) => h.setApplicability(next)),
    setEditable: (value) => withHandle((h) => h.setEditable(value)),
    getJSON: () =>
      handleRef.current?.getJSON() ?? { type: 'doc', content: [] },
    focus: () => withHandle((h) => h.focus()),
    insertTable: (options) =>
      disposed || !handleRef.current ? false : handleRef.current.insertTable(options),
    addTableRowBefore: () =>
      disposed || !handleRef.current ? false : handleRef.current.addTableRowBefore(),
    addTableRowAfter: () =>
      disposed || !handleRef.current ? false : handleRef.current.addTableRowAfter(),
    addTableColumnBefore: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.addTableColumnBefore(),
    addTableColumnAfter: () =>
      disposed || !handleRef.current ? false : handleRef.current.addTableColumnAfter(),
    on: emitter.on,
    off: emitter.off,
    destroy: () => {
      if (disposed) return
      disposed = true
      handleRef.current = null
      pending.length = 0
      emitter.clear()
      queueMicrotask(() => root.unmount())
    },
  }
}
