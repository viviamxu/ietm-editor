import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { JSONContent } from "@tiptap/core";
import {
  getDescriptionInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
} from "./extensions/S1000DNodes";
import {
  IETMEditorRoot,
  type IETMEditorRootHandle,
} from "./components/editor/IETMEditorRoot";
import type {
  InsertTableOptions,
} from "./components/editor/IETMEditor";
import type { SaveDmXmlHandler } from "./types/saveDmXmlHandler";
import {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
} from "./store/descriptionSchemaStore";
import { useInsertPublicationModalStore } from "./store/insertPublicationModalStore";
import type {
  DescriptionSchema,
  DescriptionSchemaRule,
} from "./types/descriptionSchema";
import {
  buildEmptyDescriptionBodyFromSchema,
  buildEmptyDescriptionDocJson,
  clearContent,
  exportEditorToDmXmlString,
  fillEmptyContentFromSchema,
} from "./lib/s1000d/descriptionSchemaInsert";
import "./style.css";

export {
  getDescriptionInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
};
export {
  buildEmptyDescriptionBodyFromSchema,
  buildEmptyDescriptionDocJson,
  clearContent,
  exportEditorToDmXmlString,
  fillEmptyContentFromSchema,
};

export type { JSONContent };
export type { DescriptionSchema, DescriptionSchemaRule };
export {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
};
export { useInsertPublicationModalStore };

export type { SaveDmXmlHandler };

export interface IETMEditorOptions {
  element: HTMLElement;
  content?: JSONContent | string;
  /**
   * 整段 DM XML（含 `<dmodule>`）。与 `content` 同时存在时以本字段为准。
   * 若无 `<content>/<description>` 可导入正文：若同时传了 `content` 则用之；否则按 `descriptionSchema`（或 store 默认 schema）插入最小合法稿。
   */
  dmXml?: string;
  editable?: boolean;
  /** 服务端下发的描述类 schema；不传则使用内置默认，卸载实例时会恢复默认（若创建时传入了本字段） */
  descriptionSchema?: DescriptionSchema;
  /**
   * 工具栏「保存」：传入时生成完整 DM XML 并调用本回调（不触发下载）；不传时与原先一致，触发本地下载。
   */
  onSaveDmXml?: SaveDmXmlHandler;
}

export interface IETMEditorEvents {
  update: { json: JSONContent };
  selectionChange: { from: number; to: number };
  ready: void;
}

export type IETMEditorEventName = keyof IETMEditorEvents;

export type IETMEditorEventHandler<E extends IETMEditorEventName> = (
  payload: IETMEditorEvents[E],
) => void;

export interface IETMEditorInstance {
  setContent(content: JSONContent | string): void;
  /**
   * 用整段 DM XML 替换正文（抽取 `<content>/<description>` 并导入）。须在 `ready` 后调用更稳妥。
   * 若无合法 description 正文，则按当前 schema 写入最小合法稿（与 `fillEmptyContentFromSchema` 一致）。
   * @returns 未就绪或写入失败时为 `false`
   */
  loadDmXml(dmXml: string): boolean;
  /**
   * 按当前描述类 schema（`getDescriptionSchema()`，含创建实例时传入的 `descriptionSchema`）
   * 将正文设为最小合法 S1000D 文档。须在 `ready` 后调用更稳妥。
   * @returns 未就绪时为 `false`
   */
  fillEmptyContentFromSchema(): boolean;
  setEditable(value: boolean): void;
  getJSON(): JSONContent;
  focus(): void;
  /** 光标处插入表格；默认 3×3 且带表头。须在编辑器就绪后调用，否则返回 false。 */
  insertTable(options?: InsertTableOptions): boolean;
  /** 相对当前单元格在其上方插入一行；失败（如不在表格内）时返回 false。 */
  addTableRowBefore(): boolean;
  /** 相对当前单元格在其下方插入一行。 */
  addTableRowAfter(): boolean;
  /** 相对当前单元格在其左侧插入一列。 */
  addTableColumnBefore(): boolean;
  /** 相对当前单元格在其右侧插入一列。 */
  addTableColumnAfter(): boolean;
  on<E extends IETMEditorEventName>(
    event: E,
    handler: IETMEditorEventHandler<E>,
  ): () => void;
  off<E extends IETMEditorEventName>(
    event: E,
    handler: IETMEditorEventHandler<E>,
  ): void;
  destroy(): void;
}

type EmitterMap = {
  [E in IETMEditorEventName]: Set<IETMEditorEventHandler<E>>;
};

function createEmitter(): {
  on: IETMEditorInstance["on"];
  off: IETMEditorInstance["off"];
  emit: <E extends IETMEditorEventName>(
    event: E,
    payload: IETMEditorEvents[E],
  ) => void;
  clear: () => void;
} {
  const map: EmitterMap = {
    update: new Set(),
    selectionChange: new Set(),
    ready: new Set(),
  };
  return {
    on(event, handler) {
      (map[event] as Set<typeof handler>).add(handler);
      return () => {
        (map[event] as Set<typeof handler>).delete(handler);
      };
    },
    off(event, handler) {
      (map[event] as Set<typeof handler>).delete(handler);
    },
    emit(event, payload) {
      const set = map[event] as Set<IETMEditorEventHandler<typeof event>>;
      set.forEach((handler) => handler(payload));
    },
    clear() {
      (Object.keys(map) as IETMEditorEventName[]).forEach((key) => {
        map[key].clear();
      });
    },
  };
}

function resolveInitialEditorContent(
  options: IETMEditorOptions,
): JSONContent | string | undefined {
  if (typeof options.dmXml === "string") {
    const inner = getDescriptionInnerXmlFromDmXml(options.dmXml);
    if (inner != null) return inner;
    if (options.content !== undefined) return options.content;
    return buildEmptyDescriptionDocJson(
      options.descriptionSchema ?? getDescriptionSchema(),
    );
  }
  return options.content;
}

export function createIETMEditor(
  options: IETMEditorOptions,
): IETMEditorInstance {
  if (!options.element) {
    throw new Error("[ietm-editor] options.element is required");
  }

  let disposed = false;
  const root: Root = createRoot(options.element);
  const emitter = createEmitter();

  const handleRef: { current: IETMEditorRootHandle | null } = { current: null };
  const pending: Array<(handle: IETMEditorRootHandle) => void> = [];

  const withHandle = (fn: (handle: IETMEditorRootHandle) => void) => {
    if (disposed) return;
    if (handleRef.current) {
      fn(handleRef.current);
      return;
    }
    pending.push(fn);
  };

  const setHandle = (handle: IETMEditorRootHandle | null) => {
    handleRef.current = handle;
    if (handle) {
      const queue = pending.splice(0, pending.length);
      queue.forEach((fn) => fn(handle));
    }
  };

  root.render(
    createElement(IETMEditorRoot, {
      ref: setHandle,
      initialContent: resolveInitialEditorContent(options),
      initialEditable: options.editable ?? true,
      initialDescriptionSchema: options.descriptionSchema,
      onSaveDmXml: options.onSaveDmXml,
      onUpdate: (json) => emitter.emit("update", { json }),
      onSelectionChange: (range) => emitter.emit("selectionChange", range),
      onReady: () => emitter.emit("ready", undefined),
    }),
  );

  return {
    setContent: (content) => withHandle((h) => h.setContent(content)),
    loadDmXml: (dmXml) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.loadDmXml(dmXml);
    },
    fillEmptyContentFromSchema: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.fillEmptyContentFromSchema(),
    setEditable: (value) => withHandle((h) => h.setEditable(value)),
    getJSON: () => handleRef.current?.getJSON() ?? { type: "doc", content: [] },
    focus: () => withHandle((h) => h.focus()),
    insertTable: (options) =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.insertTable(options),
    addTableRowBefore: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.addTableRowBefore(),
    addTableRowAfter: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.addTableRowAfter(),
    addTableColumnBefore: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.addTableColumnBefore(),
    addTableColumnAfter: () =>
      disposed || !handleRef.current
        ? false
        : handleRef.current.addTableColumnAfter(),
    on: emitter.on,
    off: emitter.off,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      handleRef.current = null;
      pending.length = 0;
      emitter.clear();
      queueMicrotask(() => root.unmount());
    },
  };
}
