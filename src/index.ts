import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { JSONContent } from "@tiptap/core";
import {
  getDescriptionInnerXmlFromDmXml,
  getFaultIsolationInnerXmlFromDmXml,
  getProcedureInnerXmlFromDmXml,
  getDmInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
} from "./extensions/S1000DNodes";
import {
  IETMEditorRoot,
  type IETMEditorRootHandle,
} from "./components/editor/IETMEditorRoot";
import type { InsertTableOptions } from "./components/editor/IETMEditor";
import type {
  OpenDmPdfPreviewContext,
  OpenDmPdfPreviewHandler,
} from "./types/dmPdfPreviewHandler";
import type { SaveDmXmlHandler } from "./types/saveDmXmlHandler";
import type { IETMEditorFooterStatus } from "./types/ietmEditorFooter";
import {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
} from "./store/descriptionSchemaStore";
import {
  resetProcedureDictionaries,
  setProcedureDictionaries,
} from "./store/procedureDictionaryStore";
import {
  resetProcedureUiConfig,
  setProcedureUiConfig,
} from "./store/procedureUiConfigStore";
import { useToolbarConfigStore } from "./store/toolbarConfigStore";
import type {
  BuiltinToolbarItemId,
  CustomToolbarItem,
  InsertDmRefPayload,
  OpenExternalRefContext,
  InsertImagePayload,
  ToolbarConfig,
  ToolbarItemContext,
  ToolbarItemPlacement,
  ToolbarTab,
} from "./types/toolbar";
import type {
  DescriptionSchema,
  DescriptionSchemaRule,
} from "./types/descriptionSchema";
import type { ProcedureDictionaries } from "./types/procedureDictionaries";
import type { ProcedureUiConfig } from "./types/procedureUiConfig";
import type { InsertMultimediaPayload } from "./lib/editor/insertMultimedia";
import {
  buildEmptyDescriptionBodyFromSchema,
  buildEmptyDescriptionDocJson,
  clearContent,
  exportEditorToDmXmlString,
  fillEmptyContentFromSchema,
} from "./lib/s1000d/descriptionSchemaInsert";
import { buildEmptyDocJsonFromSchema } from "./lib/s1000d/dmEmptyContent";
import type { IsolationFlowPayload } from "./lib/s1000d/isolationFlowBridge";
import { normalizeDmDocumentName } from "./lib/ietm/dmDocumentName";
import {
  DEFAULT_DM_PDF_PREVIEW_PATH,
  openDmPdfPreview,
  pdfPreviewResultToUrl,
  resolveDmPdfPreviewUrl,
} from "./lib/ietm/dmPdfPreview";
import { useDmMetadataStore } from "./store/dmMetadataStore";
import "./style.css";

export { normalizeDmDocumentName } from "./lib/ietm/dmDocumentName";
export {
  DEFAULT_DM_PDF_PREVIEW_PATH,
  openDmPdfPreview,
  pdfPreviewResultToUrl,
  resolveDmPdfPreviewUrl,
};

export {
  getDescriptionInnerXmlFromDmXml,
  getFaultIsolationInnerXmlFromDmXml,
  getProcedureInnerXmlFromDmXml,
  getDmInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
};
export {
  getDmContentKind,
  isDescriptionDm,
  isFaultIsolationDm,
  isProcedureDm,
} from "./lib/s1000d/dmContentKind";
export type { DmContentKind } from "./lib/s1000d/dmContentKind";
export {
  buildEmptyFaultIsolationDocJson,
  buildMinimalFaultIsolationProcedureJson,
  insertFaultIsolationFromSchema,
} from "./lib/s1000d/faultIsolationInsert";
export {
  buildEmptyProcedureDocJson,
  buildMinimalMainProcedureJson,
  buildMinimalPreliminaryRqmtsJson,
  buildMinimalCloseRqmtsJson,
  buildMinimalProceduralStepJson,
  insertProceduralStepAtCursor,
} from "./lib/s1000d/procedureInsert";
export { buildEmptyDocJsonFromSchema } from "./lib/s1000d/dmEmptyContent";
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
  getProcedureDictionaries,
  resetProcedureDictionaries,
  setProcedureDictionaries,
  useProcedureDictionaryStore,
} from "./store/procedureDictionaryStore";
export type {
  ProcedureDictionaries,
  ProcedureDictionaryOption,
} from "./types/procedureDictionaries";
export {
  getProcedureUiConfig,
  resetProcedureUiConfig,
  setProcedureUiConfig,
  useProcedureUiConfigStore,
} from "./store/procedureUiConfigStore";
export {
  resolveProcedureSectionHeading,
  formatProcedureSectionNumber,
  computeProcedureSectionNumberSegments,
} from "./lib/s1000d/procedureSectionHeading";
export type {
  ProcedureUiConfig,
  ProcedureOutlineEntry,
  ProcedureNumberingConfig,
  ProcedureSectionHeading,
  ProcedureSectionPresentation,
} from "./types/procedureUiConfig";
export {
  getDescriptionSchema,
  resetDescriptionSchema,
  setDescriptionSchema,
  useDescriptionSchemaStore,
};
export {
  useInsertPublicationModalStore,
  type InsertPublicationMode,
} from "./store/insertPublicationModalStore";
export { insertMultimediaIntoEditor } from "./lib/editor/insertMultimedia";
export {
  buildDmRefJsonFromPayload,
  canInsertDmRefIntoEditor,
  insertDmRefsIntoEditor,
} from "./lib/editor/insertDmRefs";
export { openExternalRefPublication } from "./lib/editor/openExternalRef";
export {
  formatDmCodeLabel,
  parseDmRefDisplayMeta,
  parseDmRefDisplayTitle,
} from "./extensions/s1000d/dmRefDisplay";
export type { DmRefDisplayMeta } from "./extensions/s1000d/dmRefDisplay";
export { useToolbarConfigStore };
export type {
  BuiltinToolbarItemId,
  CustomToolbarItem,
  InsertDmRefPayload,
  OpenExternalRefContext,
  InsertImagePayload,
  InsertMultimediaPayload,
  ToolbarConfig,
  ToolbarItemContext,
  ToolbarItemPlacement,
  ToolbarTab,
};

export type { SaveDmXmlHandler };
export type { OpenDmPdfPreviewContext, OpenDmPdfPreviewHandler };
export type {
  IETMEditorFooterStatus,
  IETMEditorFooterVariant,
} from "./types/ietmEditorFooter";

export interface IETMEditorOptions {
  element: HTMLElement;
  content?: JSONContent | string;
  /**
   * 整段 DM XML（含 `<dmodule>`）。与 `content` 同时存在时以本字段为准。
   * 若无 `<content>/<description>` 可导入正文：若同时传了 `content` 则用之；否则按 `descriptionSchema`（或 store 默认 schema）插入最小合法稿。
   */
  dmXml?: string;
  /**
   * 顶栏文档标题：XML 文件名（可含 `.xml` 或路径，展示时去掉后缀）。
   * 例如 `描述类.xml` → `描述类`。
   */
  dmDocumentName?: string;
  editable?: boolean;
  /** 服务端下发的描述类 schema；不传则使用内置默认，卸载实例时会恢复默认（若创建时传入了本字段） */
  descriptionSchema?: DescriptionSchema;
  /** 程序类人员/技能/工时单位字典；不传则使用 `src/data/procedureDictionaries.json` */
  procedureDictionaries?: ProcedureDictionaries;
  /** 程序类大纲标题与编号；不传则使用 `src/data/procedureUiConfig.json` */
  procedureUiConfig?: ProcedureUiConfig;
  /**
   * 工具栏「保存」：传入时生成完整 DM XML 并调用本回调（不触发下载）；不传时与原先一致，触发本地下载。
   */
  onSaveDmXml?: SaveDmXmlHandler;
  /**
   * 底栏「预览」一站式回调：由宿主用 `exportDmXml` 调预览接口，不强制先保存。
   * 传入后忽略 `apiBaseUrl` / `fetchDmPdfPreview` 等内置预览请求。
   */
  onOpenDmPdfPreview?: OpenDmPdfPreviewHandler;
  /**
   * API 根路径（如 `https://api.example.com` 或 `''` 表示与页面同源）。
   * 底栏「预览」会直接请求 `{apiBaseUrl}/czy-ietm-admin/ietm/preview/dm/pdf`（可用 `dmPdfPreviewPath` 覆盖路径）。
   */
  apiBaseUrl?: string;
  /** 覆盖 DM PDF 预览接口路径，默认 `/czy-ietm-admin/ietm/preview/dm/pdf` */
  dmPdfPreviewPath?: string;
  /** 自定义预览请求（不强制先保存；`onOpenDmPdfPreview` 未传时生效） */
  fetchDmPdfPreview?: () => Promise<string | Blob>;
  /**
   * ICN 信息接口路径，默认 `/czy-ietm-admin/ietm/icn/icnInfo`。
   * 与 `apiBaseUrl` 拼接后作为「插入多媒体」弹框的数据来源。
   */
  icnInfoPath?: string;
  /**
   * `@ietm-manual/preview` 静态资源根路径，传给 `setLibPath()`，默认 `"/"`。
   * 决定 cc-3d-scene 加载 Draco 等依赖资源的基准路径。
   */
  previewLibPath?: string;
  /**
   * 可编辑状态变化时通知宿主（含工具栏锁定/编辑切换与 `instance.setEditable`）。
   */
  onEditableChange?: (editable: boolean) => void;
  /** 工具栏可编辑状态下「锁定」按钮的 `title`；默认「锁定（只读）」 */
  lockReadonlyButtonTitle?: string;
  /** 工具栏只读状态下「编辑」按钮的 `title`；默认「编辑」 */
  editModeButtonTitle?: string;
  /**
   * 覆盖底栏 `.ietm-app-footer` 展示：`variant` 决定样式，`text` 为宿主文案。
   * 不传时按 `editable` 自动：`saved` +「已保存」或可编辑关闭时的 `readonly` + 默认只读提示。
   */
  footerStatus?: IETMEditorFooterStatus;
  /**
   * 格式工具栏配置：自定义按钮、隐藏内置项、宿主接管插入图片/多媒体等。
   * 亦可通过 `instance.setToolbarConfig()` 在运行时更新。
   */
  toolbar?: ToolbarConfig;
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
  loadDmXml(dmXml: string, documentName?: string): boolean;
  /** 设置顶栏文档标题（XML 文档名，如 `描述类` 或 `描述类.xml`） */
  setDmDocumentName(name: string): void;
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
  /**
   * 设置底栏状态；传入 `null` 恢复为根据当前 `editable` 的内置默认。
   */
  setFooterStatus(status: IETMEditorFooterStatus | null): void;
  /** 更新工具栏配置；传 `null` 恢复默认 */
  setToolbarConfig(config: ToolbarConfig | null): void;
  /** 在光标处插入一张或多张 S1000D `image` 节点（宿主选图后调用） */
  insertImages(images: InsertImagePayload[]): boolean;
  /** 在光标处插入一条或多条 S1000D `dmRef` 外部引用（宿主选 DM 后调用） */
  insertDmRefs(items: InsertDmRefPayload[]): boolean;
  /** 在光标处插入 `multimedia` / `multimediaObject`（`infoEntityIdent`） */
  insertMultimedia(items: InsertMultimediaPayload[]): boolean;
  /**
   * 重新加载 PDF 预览：会重新调用 `onOpenDmPdfPreview`（若配置）并更新预览窗格。
   * 若预览窗格当前关闭，则会自动打开并加载。
   */
  refreshDmPdfPreview(): void;
  /** 隔离流程编排器保存后写回对应隔离程序。 */
  applyIsolationFlow(payload: IsolationFlowPayload): boolean;
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
    const schema = options.descriptionSchema ?? getDescriptionSchema();
    const inner = getDmInnerXmlFromDmXml(options.dmXml, schema);
    if (inner != null) return inner;
    if (options.content !== undefined) return options.content;
    return buildEmptyDocJsonFromSchema(schema);
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

  if (options.toolbar) {
    useToolbarConfigStore.getState().setToolbarConfig(options.toolbar);
  }

  if (options.dmDocumentName) {
    useDmMetadataStore
      .getState()
      .setDocumentDisplayTitle(normalizeDmDocumentName(options.dmDocumentName));
  }

  if (options.procedureDictionaries) {
    setProcedureDictionaries(options.procedureDictionaries);
  }

  if (options.procedureUiConfig) {
    setProcedureUiConfig(options.procedureUiConfig);
  }

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
      onOpenDmPdfPreview: options.onOpenDmPdfPreview,
      apiBaseUrl: options.apiBaseUrl,
      dmPdfPreviewPath: options.dmPdfPreviewPath,
      fetchDmPdfPreview: options.fetchDmPdfPreview,
      icnInfoPath: options.icnInfoPath,
      previewLibPath: options.previewLibPath,
      onEditableChange: options.onEditableChange,
      lockReadonlyButtonTitle: options.lockReadonlyButtonTitle,
      editModeButtonTitle: options.editModeButtonTitle,
      footerStatus: options.footerStatus,
      onUpdate: (json) => emitter.emit("update", { json }),
      onSelectionChange: (range) => emitter.emit("selectionChange", range),
      onReady: () => emitter.emit("ready", undefined),
    }),
  );

  return {
    setContent: (content) => withHandle((h) => h.setContent(content)),
    loadDmXml: (dmXml, documentName) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.loadDmXml(dmXml, documentName);
    },
    setDmDocumentName: (name) => {
      useDmMetadataStore
        .getState()
        .setDocumentDisplayTitle(normalizeDmDocumentName(name));
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
    setFooterStatus: (status) => withHandle((h) => h.setFooterStatus(status)),
    setToolbarConfig: (config) => {
      useToolbarConfigStore.getState().setToolbarConfig(config);
    },
    insertImages: (images) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.insertImages(images);
    },
    insertDmRefs: (items) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.insertDmRefs(items);
    },
    insertMultimedia: (items) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.insertMultimedia(items);
    },
    refreshDmPdfPreview: () => withHandle((h) => h.refreshDmPdfPreview()),
    applyIsolationFlow: (payload) => {
      if (disposed || !handleRef.current) return false;
      return handleRef.current.applyIsolationFlow(payload);
    },
    on: emitter.on,
    off: emitter.off,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      handleRef.current = null;
      pending.length = 0;
      emitter.clear();
      useToolbarConfigStore.getState().resetToolbarConfig();
      if (options.procedureDictionaries) {
        resetProcedureDictionaries();
      }
      if (options.procedureUiConfig) {
        resetProcedureUiConfig();
      }
      queueMicrotask(() => root.unmount());
    },
  };
}
