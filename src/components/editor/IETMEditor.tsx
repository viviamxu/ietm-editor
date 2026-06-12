import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  useReducer,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Tabs } from "@arco-design/web-react";
import { Underline } from "../../extensions/s1000d/underlineMark";
import { Overline } from "../../extensions/s1000d/overlineMark";
import { Strikethrough } from "../../extensions/s1000d/strikethroughMark";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style/text-style-kit";
import type { JSONContent } from "@tiptap/core";
import { IETMImage } from "../../extensions/IETMImage";
import { SourceXmlAttrKeysExtension } from "../../extensions/sourceXmlAttrKeysExtension";
import { ProcedureBlockIdExtension } from "../../extensions/s1000d/procedureBlockIdExtension";
import { MigrateParagraphToParaExtension } from "../../extensions/migrateParagraphToParaExtension";
import { S1000DParagraph } from "../../extensions/s1000d/s1000dParagraph";
import { S1000DListExitKeymap } from "../../extensions/s1000d/s1000dListExitKeymap";
import { S1000DFmftBlockEnterKeymap } from "../../extensions/s1000d/s1000dFmftBlockEnterKeymap";
import { S1000DHostBlockAfterClickExtension } from "../../extensions/s1000d/s1000dHostBlockAfterClickExtension";
import { S1000DHostBlockTrailingParaBackspaceKeymap } from "../../extensions/s1000d/s1000dHostBlockTrailingParaBackspaceKeymap";
import { RepairOrphanTgroupExtension } from "../../extensions/s1000d/repairOrphanTgroupExtension";
import { S1000dAttentionParaKeymap } from "../../extensions/s1000d/s1000dAttentionParaKeymap";
import { S1000DNestingKeymap } from "../../extensions/s1000d/s1000dNestingKeymap";
import {
  dispatchSectionNumbersSync,
  S1000dSectionNumbersExtension,
} from "../../extensions/s1000d/s1000dSectionNumbers";
import {
  getDmInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
  s1000dPhase1Nodes,
} from "../../extensions/S1000DNodes";
import { s1000dFaultIsolationNodes } from "../../extensions/s1000d/faultIsolationNodes";
import {
  s1000dProcedureNodes,
  PROCEDURE_TEXT_ALIGN_NODE_TYPES,
} from "../../extensions/s1000d/procedureNodes";
import { migrateParagraphInJson } from "../../lib/editor/migrateParagraphToPara";
import { hydrateMultimediaObjectsInEditor } from "../../lib/ietm/multimediaIcnHydrate";
import { FormatToolbar } from "./FormatToolbar";
import { S1000DPropertyPanel } from "./S1000DPropertyPanel";
import {
  resolveInspectable,
  type InspectTarget,
} from "../../lib/editor/resolveInspectable";
import {
  consumeInternalRefJumpGuard,
  peekSuppressPropertyPanelOpen,
} from "../../lib/editor/internalRefNavigate";
import {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";
import {
  exportEditorToDmXmlString,
  fillEmptyContentFromSchema as applyFillEmptyContentFromSchema,
  insertTableFromSchema,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { buildEmptyDocJsonFromSchema } from "../../lib/s1000d/dmEmptyContent";
import {
  applyIsolationFlowToEditor,
  type IsolationFlowPayload,
} from "../../lib/s1000d/isolationFlowBridge";
import { PasteWordTableExtension } from "../../extensions/s1000d/pasteWordTableExtension";
import { S1000dTableCellSelectionExtension } from "../../extensions/s1000d/s1000dTableCellSelectionExtension";
import { tableSelectionPluginKey } from "../../lib/editor/tableSelection";

import { insertDmRefsIntoEditor } from "../../lib/editor/insertDmRefs";
import { insertImagesIntoEditor } from "../../lib/editor/insertImages";
import {
  insertMultimediaIntoEditor,
  type InsertMultimediaPayload,
} from "../../lib/editor/insertMultimedia";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { normalizeDmDocumentName } from "../../lib/ietm/dmDocumentName";
import { useDmMetadataStore } from "../../store/dmMetadataStore";
import { usePropertyPanelStore } from "../../store/propertyPanelStore";
import type {
  InsertDmRefPayload,
  InsertImagePayload,
} from "../../types/toolbar";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Combine,
  Eraser,
  PanelTop,
  Rows3,
  Split,
  Trash2,
  LockKeyhole,
  Loader,
  Check,
  Settings2,
} from "lucide-react";
import type { OpenDmPdfPreviewHandler } from "../../types/dmPdfPreviewHandler";
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";
import type { IETMEditorFooterStatus } from "../../types/ietmEditorFooter";
import { Code2, Eye } from "lucide-react";
import { DmPdfPreviewPane } from "./DmPdfPreviewPane";
import { PropertySettingsEmptyPane } from "./PropertySettingsEmptyPane";
import { SourceXmlView } from "./SourceXmlView";
import { openDmPdfPreview } from "../../lib/ietm/dmPdfPreview";

type EditorViewMode = "editor" | "source";

export interface InsertTableOptions {
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}

export interface IETMEditorRefValue {
  setContent: (content: JSONContent | string) => void;
  /**
   * 用整段 DM XML（含 `<dmodule>`）替换正文：抽取 `<content>/<description>` 子树并导入编辑器。
   * 若无合法 description 正文，则按当前 schema 写入最小合法稿。
   * @returns 未就绪或写入失败时为 `false`
   */
  loadDmXml: (dmXml: string, documentName?: string) => boolean;
  setDmDocumentName: (name: string) => void;
  /**
   * 按当前 `getDescriptionSchema()`（含 `createIETMEditor({ descriptionSchema })` / `setDescriptionSchema`）
   * 将正文设为 schema 约束下的最小合法文档。
   */
  fillEmptyContentFromSchema: () => boolean;
  getJSON: () => JSONContent;
  focus: () => void;
  insertTable: (options?: InsertTableOptions) => boolean;
  addTableRowBefore: () => boolean;
  addTableRowAfter: () => boolean;
  addTableColumnBefore: () => boolean;
  addTableColumnAfter: () => boolean;
  /** 在光标处插入一张或多张 S1000D 图片节点 */
  insertImages: (images: InsertImagePayload[]) => boolean;
  /** 在光标处插入一条或多条 S1000D `dmRef` 外部引用 */
  insertDmRefs: (items: InsertDmRefPayload[]) => boolean;
  insertMultimedia: (items: InsertMultimediaPayload[]) => boolean;
  /**
   * 重新加载 PDF 预览：会重新调用 `onOpenDmPdfPreview`（若配置）并更新预览窗格。
   * 若预览窗格当前关闭，则会自动打开并加载。
   */
  refreshDmPdfPreview: () => void;
  /** 将隔离流程编排器保存结果写回当前 DM 中对应的 `faultIsolationProcedure`。 */
  applyIsolationFlow: (payload: IsolationFlowPayload) => boolean;
}

interface IETMEditorProps {
  initialContent?: JSONContent | string;
  editable: boolean;
  onEditableChange: (editable: boolean) => void;
  onSaveDmXml?: SaveDmXmlHandler;
  onUpdate: (json: JSONContent) => void;
  onSelectionChange: (range: { from: number; to: number }) => void;
  onReady: () => void;
  /** 可编辑状态下「锁定」按钮的 `title`；默认「锁定（只读）」 */
  lockReadonlyButtonTitle?: string;
  /** 只读状态下「编辑」按钮的 `title`；默认「编辑」 */
  editModeButtonTitle?: string;
  /** `null` 表示按 `editable` 使用内置默认底栏状态 */
  footerStatusOverride: IETMEditorFooterStatus | null;
  /**
   * 底栏「预览」一站式回调（预览接口由宿主处理，不强制先保存）。
   * 配置后忽略内置预览请求。
   */
  onOpenDmPdfPreview?: OpenDmPdfPreviewHandler;
  /** API 根路径，与默认 `/czy-ietm-admin/ietm/preview/dm/pdf` 拼接 */
  apiBaseUrl?: string;
  /** 覆盖 DM PDF 预览接口路径 */
  dmPdfPreviewPath?: string;
  /** 自定义预览请求（不强制先保存） */
  fetchDmPdfPreview?: () => Promise<string | Blob>;
}

const FOOTER_DEFAULT_SAVED_TEXT = "已保存";
const FOOTER_DEFAULT_READONLY_TEXT = "只读：数据模块未检出";

function resolveFooterStatus(
  override: IETMEditorFooterStatus | null,
  editable: boolean,
): IETMEditorFooterStatus {
  if (override != null) return override;
  return editable
    ? { variant: "saved", text: FOOTER_DEFAULT_SAVED_TEXT }
    : { variant: "readonly", text: FOOTER_DEFAULT_READONLY_TEXT };
}

function IETMAppFooter(props: { status: IETMEditorFooterStatus }) {
  const { status } = props;
  switch (status.variant) {
    case "saved":
      return (
        <span className="ietm-save-status">
          <span className="ietm-save-status__icon" aria-hidden>
            <Check size={16} aria-hidden className="shrink-0" />
          </span>
          {status.text}
        </span>
      );
    case "saving":
      return (
        <span
          className="ietm-footer-status ietm-footer-status--saving"
          role="status"
        >
          <Loader
            size={16}
            aria-hidden
            className="ietm-footer-status__icon shrink-0"
          />
          <span className="ietm-footer-status__text">{status.text}</span>
        </span>
      );
    case "readonly":
      return (
        <span
          className="ietm-footer-status ietm-footer-status--readonly"
          role="status"
        >
          <LockKeyhole
            size={16}
            aria-hidden
            className="ietm-footer-status__icon shrink-0"
          />
          <span className="ietm-footer-status__text">{status.text}</span>
        </span>
      );
    case "error":
      return (
        <span
          className="ietm-footer-status ietm-footer-status--error"
          role="status"
        >
          {status.text}
        </span>
      );
    case "custom":
      return (
        <span
          className="ietm-footer-status ietm-footer-status--custom"
          role="status"
        >
          {status.text}
        </span>
      );
  }
}

function normalizeEditorContentInput(
  content: JSONContent | string | undefined,
): JSONContent | string | undefined {
  if (content == null) return content;
  if (typeof content === "string") {
    return preprocessS1000dDescriptionHtmlFragment(content);
  }
  return migrateParagraphInJson(content);
}

export const IETMEditor = forwardRef<IETMEditorRefValue, IETMEditorProps>(
  function IETMEditor(props, ref) {
    const readyFiredRef = useRef(false);
    const selectionAnchorRef = useRef<string>("");
    const prevActiveTabKeyRef = useRef<"file" | "edit" | "insert">("file");
    const tableTabActivatedRef = useRef(false);

    const [activeTabKey, setActiveTabKey] = useState<
      "file" | "edit" | "insert"
    >("file");

    const [propertySettingsOpen, setPropertySettingsOpen] = useState(true);
    const [viewMode, setViewMode] = useState<EditorViewMode>("editor");
    const [sourceXml, setSourceXml] = useState("");
    const [padPreviewOpen, setPadPreviewOpen] = useState(true);
    const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
    const pdfPreviewUrlRef = useRef<string | null>(null);
    const pdfPreviewRevokeRef = useRef(false);
    const pdfPreviewSeqRef = useRef(0);
    const initialPreviewLoadRef = useRef(true);
    /** 强制在选区变化时重渲染，否则 `resolveInspectable` 可能停留在上一节点（Tiptap 未必触发父组件更新） */
    const [selectionBump, bumpSelectionUi] = useReducer(
      (n: number) => n + 1,
      0,
    );

    const editor = useEditor({
      immediatelyRender: false,
      editable: props.editable,
      extensions: [
        StarterKit.configure({
          bulletList: { keepMarks: true },
          orderedList: { keepMarks: true },
          strike: false,
          paragraph: false,
          blockquote: false,
          /** 描述类用 S1000D `title`，不用 StarterKit `heading`（否则会冒出空 `<h1>`） */
          heading: false,
          /** 描述类正文不用代码块；禁用后避免 TrailingNode/回车退化为 `<pre><code>` */
          code: false,
          codeBlock: false,
          /** 不用尾随块（`paragraph` 关闭后易退化成 blockquote/codeBlock/heading） */
          trailingNode: false,
        }),
        S1000DParagraph,
        S1000DListExitKeymap,
        S1000DFmftBlockEnterKeymap,
        S1000DHostBlockAfterClickExtension,
        S1000DHostBlockTrailingParaBackspaceKeymap,
        RepairOrphanTgroupExtension,
        S1000dAttentionParaKeymap,
        S1000DNestingKeymap,
        S1000dSectionNumbersExtension,
        MigrateParagraphToParaExtension,
        PasteWordTableExtension,
        TextStyleKit.configure({
          lineHeight: false,
        }),
        Underline,
        Overline,
        Strikethrough,
        TextAlign.configure({
          types: ["para", "paragraph", ...PROCEDURE_TEXT_ALIGN_NODE_TYPES],
          alignments: ["left", "center", "right", "justify"],
          defaultAlignment: "left",
        }),
        Highlight.configure({ multicolor: true }),
        SourceXmlAttrKeysExtension,
        ProcedureBlockIdExtension,
        IETMImage.configure({
          resize: false,
        }),
        ...s1000dPhase1Nodes,
        S1000dTableCellSelectionExtension,
        ...s1000dFaultIsolationNodes,
        ...s1000dProcedureNodes,
      ],
      content:
        normalizeEditorContentInput(props.initialContent) ??
        buildEmptyDocJsonFromSchema(getDescriptionSchema()),
      editorProps: {
        attributes: {
          class: "ietm-tiptap-root",
          spellcheck: "false",
        },
        handleDOMEvents: {
          mousedown: (_view, event) => {
            if (!consumeInternalRefJumpGuard()) return false;
            event.preventDefault();
            return true;
          },
        },
      },
      onUpdate: ({ editor }) => {
        props.onUpdate(editor.getJSON());
      },
      onSelectionUpdate: ({ editor }) => {
        props.onSelectionChange({
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        });

        const anchorKey = `${editor.state.selection.anchor}-${editor.state.selection.head}`;
        if (anchorKey !== selectionAnchorRef.current) {
          selectionAnchorRef.current = anchorKey;
          if (peekSuppressPropertyPanelOpen()) {
            setPropertySettingsOpen(false);
          }
        }
        bumpSelectionUi();
      },
      onTransaction: ({ transaction }) => {
        if (transaction.getMeta(tableSelectionPluginKey) !== undefined) {
          bumpSelectionUi();
        }
      },
    });

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(props.editable);
      // 触发 transaction，让 NodeView 内 React 控件同步只读态（setEditable 本身不派发事务）
      editor.view.dispatch(editor.state.tr);
    }, [editor, props.editable]);

    useEffect(() => {
      if (!editor || readyFiredRef.current) return;
      readyFiredRef.current = true;
      props.onReady();
    }, [editor, props]);

    useEffect(() => {
      if (!editor) return;
      void hydrateMultimediaObjectsInEditor(editor);
    }, [editor]);

    const clearPdfPreviewUrl = useCallback(() => {
      if (
        pdfPreviewRevokeRef.current &&
        pdfPreviewUrlRef.current?.startsWith("blob:")
      ) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
      }
      pdfPreviewRevokeRef.current = false;
      pdfPreviewUrlRef.current = null;
      setPdfPreviewUrl(null);
    }, []);

    const dismissPadPreview = () => {
      pdfPreviewSeqRef.current += 1;
      setPadPreviewOpen(false);
      setPdfPreviewError(null);
      setPdfPreviewLoading(false);
      clearPdfPreviewUrl();
    };

    useEffect(() => {
      return () => {
        if (
          pdfPreviewRevokeRef.current &&
          pdfPreviewUrlRef.current?.startsWith("blob:")
        ) {
          URL.revokeObjectURL(pdfPreviewUrlRef.current);
        }
      };
    }, []);

    const runOpenPdfPreview = useCallback(() => {
      if (!editor) return;

      const seq = ++pdfPreviewSeqRef.current;
      setPadPreviewOpen(true);
      setPdfPreviewError(null);
      setPdfPreviewLoading(true);
      clearPdfPreviewUrl();

      void (async () => {
        try {
          const { url, revokeOnClose } = await openDmPdfPreview({
            editor,
            onOpenDmPdfPreview: props.onOpenDmPdfPreview,
            onSaveDmXml: props.onSaveDmXml,
            apiBaseUrl: props.apiBaseUrl,
            dmPdfPreviewPath: props.dmPdfPreviewPath,
            fetchDmPdfPreview: props.fetchDmPdfPreview,
          });
          if (seq !== pdfPreviewSeqRef.current) return;
          pdfPreviewRevokeRef.current = revokeOnClose;
          pdfPreviewUrlRef.current = url;
          setPdfPreviewUrl(url);
        } catch (error) {
          if (seq !== pdfPreviewSeqRef.current) return;
          const message =
            error instanceof Error ? error.message : "PDF 预览加载失败";
          setPdfPreviewError(message);
        } finally {
          if (seq !== pdfPreviewSeqRef.current) return;
          setPdfPreviewLoading(false);
        }
      })();
    }, [
      clearPdfPreviewUrl,
      editor,
      props.apiBaseUrl,
      props.dmPdfPreviewPath,
      props.fetchDmPdfPreview,
      props.onOpenDmPdfPreview,
      props.onSaveDmXml,
    ]);

    const handleSaveComplete = useCallback(() => {
      if (padPreviewOpen) {
        runOpenPdfPreview();
      }
    }, [padPreviewOpen, runOpenPdfPreview]);

    useEffect(() => {
      if (!editor || !initialPreviewLoadRef.current) return;
      initialPreviewLoadRef.current = false;
      runOpenPdfPreview();
    }, [editor, runOpenPdfPreview]);

    useImperativeHandle(
      ref,
      () => ({
        setContent: (content) => {
          editor?.commands.setContent(
            normalizeEditorContentInput(content) ?? "",
          );
        },
        loadDmXml: (dmXml, documentName) => {
          if (!editor) return false;
          if (documentName) {
            useDmMetadataStore
              .getState()
              .setDocumentDisplayTitle(normalizeDmDocumentName(documentName));
          }
          const schema = getDescriptionSchema();
          const inner = getDmInnerXmlFromDmXml(dmXml, getDescriptionSchema());
          if (inner == null) {
            return applyFillEmptyContentFromSchema(editor, schema);
          }
          editor.commands.setContent(normalizeEditorContentInput(inner) ?? "");
          void hydrateMultimediaObjectsInEditor(editor);
          queueMicrotask(() => dispatchSectionNumbersSync(editor));
          return true;
        },
        setDmDocumentName: (name) => {
          useDmMetadataStore
            .getState()
            .setDocumentDisplayTitle(normalizeDmDocumentName(name));
        },
        fillEmptyContentFromSchema: () => {
          if (!editor) return false;
          return applyFillEmptyContentFromSchema(
            editor,
            getDescriptionSchema(),
          );
        },
        getJSON: () => editor?.getJSON() ?? { type: "doc", content: [] },
        focus: () => {
          editor?.commands.focus();
        },
        insertTable: (options) => {
          if (!editor) return false;
          const rows = options?.rows ?? 3;
          const cols = options?.cols ?? 3;
          const withHeaderRow = options?.withHeaderRow ?? true;
          const headerRowCount = withHeaderRow ? 1 : 0;
          const bodyRows = Math.max(1, withHeaderRow ? rows - 1 : rows);
          return insertTableFromSchema(
            editor,
            getDescriptionSchema(),
            cols,
            headerRowCount,
            bodyRows,
          );
        },
        addTableRowBefore: () => {
          if (!editor) return false;
          const chain = editor.chain().focus() as unknown as {
            addRowBefore: () => { run: () => boolean };
          };
          return chain.addRowBefore().run();
        },
        addTableRowAfter: () => {
          if (!editor) return false;
          const chain = editor.chain().focus() as unknown as {
            addRowAfter: () => { run: () => boolean };
          };
          return chain.addRowAfter().run();
        },
        addTableColumnBefore: () => {
          if (!editor) return false;
          const chain = editor.chain().focus() as unknown as {
            addColumnBefore: () => { run: () => boolean };
          };
          return chain.addColumnBefore().run();
        },
        addTableColumnAfter: () => {
          if (!editor) return false;
          const chain = editor.chain().focus() as unknown as {
            addColumnAfter: () => { run: () => boolean };
          };
          return chain.addColumnAfter().run();
        },
        insertImages: (images) => {
          if (!editor) return false;
          return insertImagesIntoEditor(editor, images);
        },
        insertDmRefs: (items) => {
          if (!editor) return false;
          return insertDmRefsIntoEditor(editor, items);
        },
        insertMultimedia: (items) => {
          if (!editor) return false;
          return insertMultimediaIntoEditor(editor, items);
        },
        refreshDmPdfPreview: () => {
          runOpenPdfPreview();
        },
        applyIsolationFlow: (payload) => {
          if (!editor) return false;
          return applyIsolationFlowToEditor(editor, payload);
        },
      }),
      [editor, runOpenPdfPreview],
    );

    const pinnedInspect = usePropertyPanelStore((s) => s.pinnedInspect);
    const openPanelNonce = usePropertyPanelStore((s) => s.openPanelNonce);
    const pinInspect = usePropertyPanelStore((s) => s.pinInspect);

    useEffect(() => {
      if (openPanelNonce > 0) {
        setPropertySettingsOpen(true);
      }
    }, [openPanelNonce]);

    const resolvedTarget: InspectTarget | null = useMemo(() => {
      if (!editor) return null;
      if (pinnedInspect) {
        const live = editor.state.doc.nodeAt(pinnedInspect.pos);
        if (live && live.type.name === pinnedInspect.nodeType) {
          return {
            nodeType: pinnedInspect.nodeType,
            pos: pinnedInspect.pos,
            attrs: { ...live.attrs } as Record<string, unknown>,
          };
        }
      }
      return resolveInspectable(editor);
    }, [editor, pinnedInspect, selectionBump]);

    const dismissPropertyPanel = () => {
      pinInspect(null);
      setPropertySettingsOpen(false);
    };

    const showPropertyPane = propertySettingsOpen;

    const showPropertyPanelForm = showPropertyPane && resolvedTarget !== null;

    const showPreviewPane = padPreviewOpen;
    const hasDualSidePanes = showPreviewPane && showPropertyPane;
    const hasSingleSidePane =
      showPreviewPane !== showPropertyPane &&
      (showPreviewPane || showPropertyPane);

    const handleToggleViewMode = () => {
      if (!editor) return;
      if (viewMode === "editor") {
        setSourceXml(exportEditorToDmXmlString(editor));
        setViewMode("source");
        return;
      }
      setViewMode("editor");
    };

    const handlePropertySettingsClick = () => {
      if (viewMode !== "editor") return;

      if (propertySettingsOpen) {
        dismissPropertyPanel();
        return;
      }

      pinInspect(null);
      setPropertySettingsOpen(true);
      editor?.commands.focus();
    };

    const handlePadPreviewClick = () => {
      if (padPreviewOpen) {
        dismissPadPreview();
        return;
      }
      runOpenPdfPreview();
    };

    const inspectStableKey = resolvedTarget
      ? `${resolvedTarget.nodeType}-${resolvedTarget.pos}`
      : null;

    if (!editor) {
      return null;
    }

    const handleEditorPaneMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const el = e.target as Element | null;
      const clickedTable = el?.closest?.(
        ".s1000d-table-wrap, .s1000d-tgroup-table",
      );

      if (clickedTable) {
        if (!props.editable) return;
        if (activeTabKey === "edit") return;
        prevActiveTabKeyRef.current = activeTabKey;
        tableTabActivatedRef.current = true;
        setActiveTabKey("edit");
        return;
      }

      if (!tableTabActivatedRef.current) return;
      setActiveTabKey(prevActiveTabKeyRef.current);
      tableTabActivatedRef.current = false;
    };

    const runTableAction = (
      action: Parameters<typeof runS1000dTableAction>[1],
    ) => {
      runS1000dTableAction(editor, action);
    };

    const tableActionDisabled = (
      action: Parameters<typeof canRunS1000dTableAction>[1],
    ) => !canRunS1000dTableAction(editor, action);

    const headerMenuLocked = !props.editable;

    return (
      <div className="ietm-editor-root">
        <div className="ietm-editor-chrome">
          <header className="ietm-app-header">
            <Tabs
              activeTab={activeTabKey}
              onChange={(key) => setActiveTabKey(key as typeof activeTabKey)}
              type="line"
              className="ietm-app-nav"
              aria-label="主菜单"
            >
              <Tabs.TabPane key="file" title="文件">
                <div className="ietm-menu-dropdown" role="menu">
                  <button type="button" className="ietm-menu-item" disabled>
                    新建（占位）
                  </button>
                  <button type="button" className="ietm-menu-item" disabled>
                    打开（占位）
                  </button>
                </div>
              </Tabs.TabPane>

              <Tabs.TabPane key="edit" title="编辑">
                <div
                  className="ietm-menu-dropdown ietm-menu-dropdown--table-tools"
                  role="menu"
                >
                  <div className="ietm-menu-section">
                    <div className="ietm-menu-section__title">行</div>
                    <div className="ietm-menu-icon-row">
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked ||
                          tableActionDisabled("insertRowAbove")
                        }
                        onClick={() => runTableAction("insertRowAbove")}
                        title="上方插入行"
                        aria-label="上方插入行"
                      >
                        <BetweenVerticalStart size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked ||
                          tableActionDisabled("insertRowBelow")
                        }
                        onClick={() => runTableAction("insertRowBelow")}
                        title="下方插入行"
                        aria-label="下方插入行"
                      >
                        <BetweenVerticalEnd size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("deleteRow")
                        }
                        onClick={() => runTableAction("deleteRow")}
                        title="删除行"
                        aria-label="删除行"
                      >
                        <Rows3 size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked ||
                          tableActionDisabled("toggleHeader")
                        }
                        onClick={() => runTableAction("toggleHeader")}
                        title="切换表头"
                        aria-label="切换表头"
                      >
                        <PanelTop size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="ietm-menu-section">
                    <div className="ietm-menu-section__title">列</div>
                    <div className="ietm-menu-icon-row">
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked ||
                          tableActionDisabled("insertColLeft")
                        }
                        onClick={() => runTableAction("insertColLeft")}
                        title="左侧插入列"
                        aria-label="左侧插入列"
                      >
                        <BetweenHorizontalStart size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked ||
                          tableActionDisabled("insertColRight")
                        }
                        onClick={() => runTableAction("insertColRight")}
                        title="右侧插入列"
                        aria-label="右侧插入列"
                      >
                        <BetweenHorizontalEnd size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("deleteCol")
                        }
                        onClick={() => runTableAction("deleteCol")}
                        title="删除列"
                        aria-label="删除列"
                      >
                        <Columns3 size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="ietm-menu-section">
                    <div className="ietm-menu-section__title">单元格</div>
                    <div className="ietm-menu-icon-row">
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("mergeCells")
                        }
                        onClick={() => runTableAction("mergeCells")}
                        title="合并单元格"
                        aria-label="合并单元格"
                      >
                        <Combine size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("splitCell")
                        }
                        onClick={() => runTableAction("splitCell")}
                        title="拆分单元格"
                        aria-label="拆分单元格"
                      >
                        <Split size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("deleteTable")
                        }
                        onClick={() => runTableAction("deleteTable")}
                        title="删除表格"
                        aria-label="删除表格"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={
                          headerMenuLocked || tableActionDisabled("clearCell")
                        }
                        onClick={() => runTableAction("clearCell")}
                        title="清空单元格"
                        aria-label="清空单元格"
                      >
                        <Eraser size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </Tabs.TabPane>

              {/* <Tabs.TabPane key="insert" title="插入">
                <div className="ietm-menu-dropdown" role="menu">
                  <button
                    type="button"
                    className="ietm-menu-item"
                    disabled={headerMenuLocked}
                    onClick={() => {
                      insertTable();
                    }}
                  >
                    插入表格
                  </button>
                  <button
                    type="button"
                    className="ietm-menu-item"
                    disabled={headerMenuLocked}
                    onClick={() => {
                      runInsertImageAction();
                    }}
                  >
                    插入图片
                  </button>
                </div>
              </Tabs.TabPane> */}
            </Tabs>

            {/* <div className="ietm-app-header-right">
              <span
                className="ietm-doc-title"
                title={documentDisplayTitle || undefined}
              >
                数据模块标题 {documentDisplayTitle}
              </span>
            </div> */}
          </header>

          <FormatToolbar
            editor={editor}
            activeTabKey={activeTabKey}
            editable={props.editable}
            onEditableChange={props.onEditableChange}
            onSaveDmXml={props.onSaveDmXml}
            onAfterSave={handleSaveComplete}
            lockReadonlyButtonTitle={props.lockReadonlyButtonTitle}
            editModeButtonTitle={props.editModeButtonTitle}
          />
        </div>

        <div
          className={[
            "ietm-app-main",
            hasDualSidePanes && "ietm-app-main--with-preview-and-property",
            hasSingleSidePane &&
              showPreviewPane &&
              "ietm-app-main--with-preview-pane",
            hasSingleSidePane &&
              showPropertyPane &&
              "ietm-app-main--with-property-pane",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={
              viewMode === "source"
                ? "ietm-editor-pane ietm-editor-pane--source"
                : "ietm-editor-pane"
            }
            onMouseDown={
              viewMode === "editor" ? handleEditorPaneMouseDown : undefined
            }
          >
            <div
              className={
                viewMode === "source"
                  ? "ietm-editor-surface-host is-hidden"
                  : "ietm-editor-surface-host"
              }
              aria-hidden={viewMode === "source"}
            >
              <EditorContent editor={editor} className="ietm-editor-surface" />
            </div>
            {viewMode === "source" ? <SourceXmlView xml={sourceXml} /> : null}
          </div>

          {showPreviewPane ? (
            <aside
              id="ietm-pad-preview-pane"
              className="ietm-side-pane ietm-preview-pane"
            >
              <DmPdfPreviewPane
                loading={pdfPreviewLoading}
                error={pdfPreviewError}
                pdfUrl={pdfPreviewUrl}
                onDismiss={dismissPadPreview}
              />
            </aside>
          ) : null}

          {showPropertyPane ? (
            <aside
              id="ietm-property-pane"
              className="ietm-side-pane ietm-property-pane"
            >
              {showPropertyPanelForm && resolvedTarget ? (
                <S1000DPropertyPanel
                  key={inspectStableKey ?? "none"}
                  editor={editor}
                  target={resolvedTarget}
                  readOnly={!props.editable}
                  onDismiss={dismissPropertyPanel}
                />
              ) : (
                <PropertySettingsEmptyPane onDismiss={dismissPropertyPanel} />
              )}
            </aside>
          ) : null}
        </div>

        <footer className="ietm-app-footer">
          <div className="ietm-app-footer__start">
            <IETMAppFooter
              status={resolveFooterStatus(
                props.footerStatusOverride,
                props.editable,
              )}
            />
          </div>
          <div className="ietm-app-footer__actions">
            <button
              type="button"
              className={
                viewMode === "source"
                  ? "ietm-footer-icon-btn is-active"
                  : "ietm-footer-icon-btn"
              }
              aria-pressed={viewMode === "source"}
              aria-label={
                viewMode === "source" ? "切换为编辑模式" : "切换为源码模式"
              }
              title={viewMode === "source" ? "编辑模式" : "源码模式"}
              onClick={handleToggleViewMode}
            >
              <Code2 size={22} aria-hidden />
            </button>
            <button
              type="button"
              className={
                padPreviewOpen
                  ? "ietm-footer-icon-btn is-active"
                  : "ietm-footer-icon-btn"
              }
              aria-expanded={padPreviewOpen}
              aria-controls="ietm-pad-preview-pane"
              aria-label="预览"
              title="预览"
              disabled={pdfPreviewLoading}
              onClick={handlePadPreviewClick}
            >
              <Eye size={22} aria-hidden />
            </button>
            <button
              type="button"
              className={
                propertySettingsOpen
                  ? "ietm-footer-icon-btn is-active"
                  : "ietm-footer-icon-btn"
              }
              aria-expanded={propertySettingsOpen}
              aria-controls="ietm-property-pane"
              aria-label="属性设置"
              title="属性设置"
              disabled={viewMode === "source"}
              onClick={handlePropertySettingsClick}
            >
              <Settings2 size={22} aria-hidden />
            </button>
          </div>
        </footer>

        {/* The backdrop for old menu is no longer needed */}
      </div>
    );
  },
);
