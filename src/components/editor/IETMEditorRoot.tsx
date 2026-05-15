import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { JSONContent } from "@tiptap/core";
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
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";
import type { IETMEditorFooterStatus } from "../../types/ietmEditorFooter";
import { ConfigProvider } from "@arco-design/web-react";
import { ReferencePublicationModal } from "./ReferencePublicationModal";
export interface IETMEditorRootHandle {
  setContent: (content: JSONContent | string) => void;
  setEditable: (value: boolean) => void;
  /** @returns 解析失败时为 `false` */
  loadDmXml: (dmXml: string) => boolean;
  fillEmptyContentFromSchema: () => boolean;
  getJSON: () => JSONContent;
  focus: () => void;
  insertTable: (options?: InsertTableOptions) => boolean;
  addTableRowBefore: () => boolean;
  addTableRowAfter: () => boolean;
  addTableColumnBefore: () => boolean;
  addTableColumnAfter: () => boolean;
  setFooterStatus: (status: IETMEditorFooterStatus | null) => void;
}

interface IETMEditorRootProps {
  initialContent?: JSONContent | string;
  initialEditable: boolean;
  initialDescriptionSchema?: DescriptionSchema;
  onSaveDmXml?: SaveDmXmlHandler;
  onEditableChange?: (editable: boolean) => void;
  onUpdate: (json: JSONContent) => void;
  onSelectionChange: (range: { from: number; to: number }) => void;
  onReady: () => void;
  lockReadonlyButtonTitle?: string;
  editModeButtonTitle?: string;
  footerStatus?: IETMEditorFooterStatus;
}

export const IETMEditorRoot = forwardRef<
  IETMEditorRootHandle,
  IETMEditorRootProps
>(function IETMEditorRoot(props, ref) {
  const [editable, setEditable] = useState(props.initialEditable);
  const [footerStatusOverride, setFooterStatusOverride] = useState<
    IETMEditorFooterStatus | null
  >(() => props.footerStatus ?? null);
  const editorRef = useRef<IETMEditorRefValue>(null);
  const onEditableChangeRef = useRef(props.onEditableChange);
  onEditableChangeRef.current = props.onEditableChange;

  const applyEditable = useCallback((value: boolean) => {
    setEditable(value);
    onEditableChangeRef.current?.(value);
  }, []);

  useEffect(() => {
    if (!props.initialDescriptionSchema) return undefined;
    setDescriptionSchema(props.initialDescriptionSchema);
    return () => {
      resetDescriptionSchema();
    };
  }, [props.initialDescriptionSchema]);

  useImperativeHandle(
    ref,
    () => ({
      setContent: (content) => editorRef.current?.setContent(content),
      setEditable: (value) => applyEditable(value),
      loadDmXml: (xml) => editorRef.current?.loadDmXml(xml) ?? false,
      fillEmptyContentFromSchema: () =>
        editorRef.current?.fillEmptyContentFromSchema() ?? false,
      getJSON: () =>
        editorRef.current?.getJSON() ?? { type: "doc", content: [] },
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
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <ConfigProvider
        prefixCls="ietm-arco"
        getPopupContainer={getPopupContainer}
      >
        <IETMEditor
          ref={editorRef}
          initialContent={props.initialContent}
          editable={editable}
          onEditableChange={applyEditable}
          onSaveDmXml={props.onSaveDmXml}
          onUpdate={props.onUpdate}
          onSelectionChange={props.onSelectionChange}
          onReady={props.onReady}
          lockReadonlyButtonTitle={props.lockReadonlyButtonTitle}
          editModeButtonTitle={props.editModeButtonTitle}
          footerStatusOverride={footerStatusOverride}
        />
        <ReferencePublicationModal />
      </ConfigProvider>
    </div>
  );
});
