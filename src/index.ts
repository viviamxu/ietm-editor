import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { JSONContent } from '@tiptap/core'
import {
  IETMEditorRoot,
  type IETMEditorRootHandle,
} from './components/editor/IETMEditorRoot'
import {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
} from './store/descriptionSchemaStore'
import { useInsertPublicationModalStore } from './store/insertPublicationModalStore'
import type {
  DescriptionSchema,
  DescriptionSchemaRule,
} from './types/descriptionSchema'
import './style.css'

export type { JSONContent }
export type { DescriptionSchema, DescriptionSchemaRule }
export {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
}
export { useInsertPublicationModalStore }

export interface IETMEditorOptions {
  element: HTMLElement
  content?: JSONContent | string
  editable?: boolean
  /** 服务端下发的描述类 schema；不传则使用内置默认，卸载实例时会恢复默认（若创建时传入了本字段） */
  descriptionSchema?: DescriptionSchema
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
  setEditable(value: boolean): void
  getJSON(): JSONContent
  focus(): void
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
      initialEditable: options.editable ?? true,
      initialDescriptionSchema: options.descriptionSchema,
      onUpdate: (json) => emitter.emit('update', { json }),
      onSelectionChange: (range) => emitter.emit('selectionChange', range),
      onReady: () => emitter.emit('ready', undefined),
    }),
  )

  return {
    setContent: (content) => withHandle((h) => h.setContent(content)),
    setEditable: (value) => withHandle((h) => h.setEditable(value)),
    getJSON: () =>
      handleRef.current?.getJSON() ?? { type: 'doc', content: [] },
    focus: () => withHandle((h) => h.focus()),
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
