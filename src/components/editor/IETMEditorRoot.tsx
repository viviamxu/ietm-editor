import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import {
  resetDescriptionSchema,
  setDescriptionSchema,
} from "../../store/descriptionSchemaStore";
import type { DescriptionSchema } from "../../types/descriptionSchema";
import {
  IETMEditor,
  type IETMEditorRefValue,
  type InsertTableOptions,
} from "./IETMEditor";
import type { OpenDmPdfPreviewHandler } from "../../types/dmPdfPreviewHandler";
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";
import type { IETMEditorFooterStatus } from "../../types/ietmEditorFooter";
import type { InsertImagesOptions } from "../../lib/editor/insertImages";
import type { InsertSymbolOptions } from "../../lib/editor/insertSymbols";
import type { InsertMultimediaPayload } from "../../lib/editor/insertMultimedia";
import type {
  InsertDmRefPayload,
  InsertImagePayload,
} from "../../types/toolbar";
import { ConfigProvider } from "@arco-design/web-react";
import { ExternalRefPublicationModal } from "./ExternalRefPublicationModal";
import { ReferencePublicationModal } from "./ReferencePublicationModal";
import { InternalRefModal } from "./InternalRefModal";
import { useIcnInfoStore } from "../../store/icnInfoStore";
import { useFileUrlStore } from "../../store/fileUrlStore";
import {
  writeIsolationFlowPayload,
  type IsolationFlowPayload,
} from "../../lib/s1000d/isolationFlowBridge";
import { useIsolationFlowOverlayStore } from "../../store/isolationFlowOverlayStore";
import { useThemeStore } from "../../store/themeStore";
import IsolationFlowEditor from "../IsolationFlowEditor";
export interface IETMEditorRootHandle {
  setContent: (content: JSONContent | string) => void;
  setEditable: (value: boolean) => void;
  /** @returns 解析失败时为 `false` */
  loadDmXml: (dmXml: string, documentName?: string) => boolean;
  setDmDocumentName: (name: string) => void;
  fillEmptyContentFromSchema: () => boolean;
  getJSON: () => JSONContent;
  getEditor: () => Editor | null;
  focus: () => void;
  insertTable: (options?: InsertTableOptions) => boolean;
  addTableRowBefore: () => boolean;
  addTableRowAfter: () => boolean;
  addTableColumnBefore: () => boolean;
  addTableColumnAfter: () => boolean;
  setFooterStatus: (status: IETMEditorFooterStatus | null) => void;
  insertImages: (
    images: InsertImagePayload[],
    options?: InsertImagesOptions,
  ) => boolean;
  insertDmRefs: (items: InsertDmRefPayload[]) => boolean;
  insertMultimedia: (items: InsertMultimediaPayload[]) => boolean;
  insertSymbol: (
    payload: InsertImagePayload,
    options?: InsertSymbolOptions,
  ) => boolean;
  refreshDmPdfPreview: () => void;
  applyIsolationFlow: (payload: IsolationFlowPayload) => boolean;
}

interface IETMEditorRootProps {
  initialContent?: JSONContent | string;
  initialEditable: boolean;
  initialDescriptionSchema?: DescriptionSchema;
  onSaveDmXml?: SaveDmXmlHandler;
  onOpenDmPdfPreview?: OpenDmPdfPreviewHandler;
  onEditableChange?: (editable: boolean) => void;
  onUpdate: (json: JSONContent) => void;
  onSelectionChange: (range: { from: number; to: number }) => void;
  onReady: () => void;
  lockReadonlyButtonTitle?: string;
  editModeButtonTitle?: string;
  footerStatus?: IETMEditorFooterStatus;
  apiBaseUrl?: string;
  dmPdfPreviewPath?: string;
  fetchDmPdfPreview?: () => Promise<string | Blob>;
  icnInfoPath?: string;
  fileUrlPrefix?: string;
  previewLibPath?: string;
}

export const IETMEditorRoot = forwardRef<
  IETMEditorRootHandle,
  IETMEditorRootProps
>(function IETMEditorRoot(props, ref) {
  const [editable, setEditable] = useState(props.initialEditable);
  const [footerStatusOverride, setFooterStatusOverride] =
    useState<IETMEditorFooterStatus | null>(() => props.footerStatus ?? null);
  const editorRef = useRef<IETMEditorRefValue>(null);
  const onEditableChangeRef = useRef(props.onEditableChange);
  onEditableChangeRef.current = props.onEditableChange;

  const flowSession = useIsolationFlowOverlayStore((s) => s.session);
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const setPortalRoot = useThemeStore((s) => s.setPortalRoot);
  const portalRef = useRef<HTMLDivElement>(null);
  const editableBeforeFlow = useIsolationFlowOverlayStore(
    (s) => s.editableBeforeOpen,
  );
  const closeFlowOverlay = useIsolationFlowOverlayStore((s) => s.close);

  const applyEditable = useCallback((value: boolean) => {
    setEditable(value);
    onEditableChangeRef.current?.(value);
  }, []);

  useEffect(() => {
    setPortalRoot(portalRef.current);
    return () => setPortalRoot(null);
  }, [setPortalRoot]);

  useEffect(() => {
    if (!flowSession) return;
    applyEditable(false);
  }, [applyEditable, flowSession]);

  const handleFlowSave = useCallback(
    (payload: IsolationFlowPayload) => {
      editorRef.current?.applyIsolationFlow(payload);
      writeIsolationFlowPayload(payload);
      applyEditable(editableBeforeFlow);
      closeFlowOverlay();
    },
    [applyEditable, closeFlowOverlay, editableBeforeFlow],
  );

  const handleFlowCancel = useCallback(() => {
    applyEditable(editableBeforeFlow);
    closeFlowOverlay();
  }, [applyEditable, closeFlowOverlay, editableBeforeFlow]);

  useEffect(() => {
    if (!props.initialDescriptionSchema) return undefined;
    setDescriptionSchema(props.initialDescriptionSchema);
    return () => {
      resetDescriptionSchema();
    };
  }, [props.initialDescriptionSchema]);

  // 同步 ICN 接口配置到 store
  useEffect(() => {
    useIcnInfoStore.getState().setIcnInfoConfig({
      apiBaseUrl: props.apiBaseUrl ?? "",
      icnInfoPath: props.icnInfoPath,
      previewLibPath: props.previewLibPath,
    });
  }, [props.apiBaseUrl, props.icnInfoPath, props.previewLibPath]);

  useEffect(() => {
    useFileUrlStore.getState().setFileUrlPrefix(props.fileUrlPrefix ?? "");
  }, [props.fileUrlPrefix]);

  // 初始化 @ietm-manual/preview（注册 cc-3d-scene Web Component）
  useEffect(() => {
    const libPath = props.previewLibPath ?? "/";
    void import("@ietm-manual/preview/index").then((mod) => {
      if (typeof mod.setLibPath === "function") {
        mod.setLibPath(libPath);
      }
    });
  }, [props.previewLibPath]);

  useImperativeHandle(
    ref,
    () => ({
      setContent: (content) => editorRef.current?.setContent(content),
      setEditable: (value) => applyEditable(value),
      loadDmXml: (xml, documentName) =>
        editorRef.current?.loadDmXml(xml, documentName) ?? false,
      setDmDocumentName: (name) => editorRef.current?.setDmDocumentName(name),
      fillEmptyContentFromSchema: () =>
        editorRef.current?.fillEmptyContentFromSchema() ?? false,
      getJSON: () =>
        editorRef.current?.getJSON() ?? { type: "doc", content: [] },
      getEditor: () => editorRef.current?.getEditor() ?? null,
      focus: () => editorRef.current?.focus(),
      insertTable: (options) =>
        editorRef.current?.insertTable(options) ?? false,
      addTableRowBefore: () => editorRef.current?.addTableRowBefore() ?? false,
      addTableRowAfter: () => editorRef.current?.addTableRowAfter() ?? false,
      addTableColumnBefore: () =>
        editorRef.current?.addTableColumnBefore() ?? false,
      addTableColumnAfter: () =>
        editorRef.current?.addTableColumnAfter() ?? false,
      setFooterStatus: (status) => setFooterStatusOverride(status),
      insertImages: (images, options) =>
        editorRef.current?.insertImages(images, options) ?? false,
      insertDmRefs: (items) => editorRef.current?.insertDmRefs(items) ?? false,
      insertMultimedia: (items) =>
        editorRef.current?.insertMultimedia(items) ?? false,
      insertSymbol: (payload, options) =>
        editorRef.current?.insertSymbol(payload, options) ?? false,
      refreshDmPdfPreview: () => editorRef.current?.refreshDmPdfPreview(),
      applyIsolationFlow: (payload) =>
        editorRef.current?.applyIsolationFlow(payload) ?? false,
    }),
    [applyEditable],
  );
  // 定义所有内部浮层的安全挂载点
  const getPopupContainer = useCallback(() => {
    // 寻找我们铺设的结界，找不到就降级到 body
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);
  return (
    <div
      id="ietm-sdk-portal-root"
      ref={portalRef}
      data-ietm-theme={resolvedTheme}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <ConfigProvider
        prefixCls="ietm-arco"
        theme={resolvedTheme === "dark" ? { dark: true } : undefined}
        getPopupContainer={getPopupContainer}
      >
        <IETMEditor
          ref={editorRef}
          initialContent={props.initialContent}
          editable={editable}
          onEditableChange={applyEditable}
          onSaveDmXml={props.onSaveDmXml}
          onOpenDmPdfPreview={props.onOpenDmPdfPreview}
          onUpdate={props.onUpdate}
          onSelectionChange={props.onSelectionChange}
          onReady={props.onReady}
          lockReadonlyButtonTitle={props.lockReadonlyButtonTitle}
          editModeButtonTitle={props.editModeButtonTitle}
          footerStatusOverride={footerStatusOverride}
          apiBaseUrl={props.apiBaseUrl}
          dmPdfPreviewPath={props.dmPdfPreviewPath}
          fetchDmPdfPreview={props.fetchDmPdfPreview}
        />
        <ReferencePublicationModal />
        <ExternalRefPublicationModal />
        <InternalRefModal />
        {flowSession ? (
          <div
            className="ife-overlay-host"
            role="dialog"
            aria-modal="true"
            aria-label="隔离流程编排器"
          >
            <IsolationFlowEditor
              key={flowSession.procedureKey}
              payload={flowSession}
              onSave={handleFlowSave}
              onCancel={handleFlowCancel}
            />
          </div>
        ) : null}
      </ConfigProvider>
    </div>
  );
});
