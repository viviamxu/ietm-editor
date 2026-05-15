import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent,
  useReducer,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Tabs } from "@arco-design/web-react";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style/text-style-kit";
import type { JSONContent } from "@tiptap/core";
import { IETMImage } from "../../extensions/IETMImage";
import { SourceXmlAttrKeysExtension } from "../../extensions/sourceXmlAttrKeysExtension";
import {
  getDescriptionInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
  s1000dPhase1Nodes,
} from "../../extensions/S1000DNodes";
import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import { FormatToolbar } from "./FormatToolbar";
import { S1000DPropertyPanel } from "./S1000DPropertyPanel";
import {
  resolveInspectable,
  type InspectTarget,
} from "../../lib/editor/resolveInspectable";
import {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";
import {
  buildEmptyDescriptionDocJson,
  fillEmptyContentFromSchema as applyFillEmptyContentFromSchema,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Combine,
  Eraser,
  Rows3,
  Split,
  TableCellsSplit,
  Trash2,
  LockKeyhole,
  Loader,
  Check,
} from "lucide-react";
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";
import type { IETMEditorFooterStatus } from "../../types/ietmEditorFooter";

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
  loadDmXml: (dmXml: string) => boolean;
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
  if (typeof content !== "string") return content;
  return preprocessS1000dDescriptionHtmlFragment(content);
}

const DOC_TITLE_PLACEHOLDER = "数据模块标题 DMC-XXXX-XX-XXXX-XX-A-D";

function focusFirstCellByMouseLikeClick(
  editor: NonNullable<ReturnType<typeof useEditor>>,
): void {
  setTimeout(() => {
    const root = editor.view.dom as HTMLElement;
    const tables = root.querySelectorAll(
      ".s1000d-table-wrap, .s1000d-tgroup-table",
    );
    const latestTable = tables.item(tables.length - 1) as HTMLElement | null;
    if (!latestTable) return;

    const firstCell = latestTable.querySelector(
      ".s1000d-entry, td, th",
    ) as HTMLElement | null;
    if (!firstCell) return;

    firstCell.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    firstCell.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }),
    );
    firstCell.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  }, 0);
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

    const [propertiesDismissed, setPropertiesDismissed] = useState(false);
    const [editorSurfaceEngaged, setEditorSurfaceEngaged] = useState(false);
    /** 强制在选区变化时重渲染，否则 `resolveInspectable` 可能停留在上一节点（Tiptap 未必触发父组件更新） */
    const [, bumpSelectionUi] = useReducer((n: number) => n + 1, 0);

    const editor = useEditor({
      immediatelyRender: false,
      editable: props.editable,
      extensions: [
        StarterKit.configure({
          bulletList: { keepMarks: true },
          orderedList: { keepMarks: true },
        }),
        TextStyleKit.configure({
          lineHeight: false,
        }),
        Underline,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Highlight.configure({ multicolor: true }),
        SourceXmlAttrKeysExtension,
        IETMImage.configure({
          resize: false,
        }),
        ...s1000dPhase1Nodes,
      ],
      content:
        normalizeEditorContentInput(props.initialContent) ??
        buildEmptyDescriptionDocJson(getDescriptionSchema()),
      editorProps: {
        attributes: {
          class: "ietm-tiptap-root",
          spellcheck: "false",
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
          setPropertiesDismissed(false);
        }
        bumpSelectionUi();
      },
    });

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(props.editable);
    }, [editor, props.editable]);

    useEffect(() => {
      if (!editor || readyFiredRef.current) return;
      readyFiredRef.current = true;
      props.onReady();
    }, [editor, props]);

    useImperativeHandle(
      ref,
      () => ({
        setContent: (content) => {
          editor?.commands.setContent(
            normalizeEditorContentInput(content) ?? "",
          );
        },
        loadDmXml: (dmXml) => {
          if (!editor) return false;
          const inner = getDescriptionInnerXmlFromDmXml(dmXml);
          if (inner == null) {
            return applyFillEmptyContentFromSchema(
              editor,
              getDescriptionSchema(),
            );
          }
          editor.commands.setContent(normalizeEditorContentInput(inner) ?? "");
          return true;
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
          const chain = editor.chain().focus() as unknown as {
            insertTable: (opts: {
              rows: number;
              cols: number;
              withHeaderRow: boolean;
            }) => { run: () => boolean };
          };
          const inserted = chain
            .insertTable({
              rows: options?.rows ?? 3,
              cols: options?.cols ?? 3,
              withHeaderRow: options?.withHeaderRow ?? true,
            })
            .run();
          if (inserted) {
            focusFirstCellByMouseLikeClick(editor);
          }
          return inserted;
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
      }),
      [editor],
    );

    const resolvedTarget: InspectTarget | null = editor
      ? resolveInspectable(editor)
      : null;

    const showPropertyPanel =
      editorSurfaceEngaged && resolvedTarget !== null && !propertiesDismissed;

    const inspectStableKey = resolvedTarget
      ? `${resolvedTarget.nodeType}-${resolvedTarget.pos}`
      : null;

    useEffect(() => {
      setPropertiesDismissed(false);
    }, [inspectStableKey]);

    if (!editor) {
      return null;
    }

    const handleEditorPaneMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      setEditorSurfaceEngaged(true);
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

    const insertTable = () => {
      const inserted = editor
        .chain()
        .focus()
        .insertContent(createMinimalS1000dTableInsertJson(4, 1, 3))
        .run();
      if (inserted) {
        focusFirstCellByMouseLikeClick(editor);
      }
      return inserted;
    };

    const insertImageFromPrompt = () => {
      const url = window.prompt("请输入图片 URL");
      if (!url) return;
      editor.chain().focus().setImage({ src: url }).run();
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
                          headerMenuLocked || tableActionDisabled("deleteCell")
                        }
                        onClick={() => runTableAction("deleteCell")}
                        title="删除单元格"
                        aria-label="删除单元格"
                      >
                        <TableCellsSplit size={16} aria-hidden />
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
                    </div>
                  </div>
                </div>
              </Tabs.TabPane>

              <Tabs.TabPane key="insert" title="插入">
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
                      insertImageFromPrompt();
                    }}
                  >
                    插入图片
                  </button>
                </div>
              </Tabs.TabPane>
            </Tabs>

            <div className="ietm-app-header-right">
              <span className="ietm-doc-title">{DOC_TITLE_PLACEHOLDER}</span>
              <button type="button" className="ietm-share-btn" disabled>
                分享
              </button>
              <span className="ietm-user-avatar" aria-hidden>
                A
              </span>
            </div>
          </header>

          <FormatToolbar
            editor={editor}
            activeTabKey={activeTabKey}
            editable={props.editable}
            onEditableChange={props.onEditableChange}
            onSaveDmXml={props.onSaveDmXml}
            lockReadonlyButtonTitle={props.lockReadonlyButtonTitle}
            editModeButtonTitle={props.editModeButtonTitle}
          />
        </div>

        <div className="ietm-app-main">
          <div
            className="ietm-editor-pane"
            onMouseDown={handleEditorPaneMouseDown}
            onFocusCapture={() => setEditorSurfaceEngaged(true)}
          >
            <EditorContent editor={editor} className="ietm-editor-surface" />
          </div>

          <aside className="ietm-right-pane">
            {showPropertyPanel && resolvedTarget ? (
              <S1000DPropertyPanel
                key={inspectStableKey ?? "none"}
                editor={editor}
                target={resolvedTarget}
                readOnly={!props.editable}
                onDismiss={() => setPropertiesDismissed(true)}
              />
            ) : (
              <div className="ietm-preview-placeholder">
                <p>功能开发中，敬请期待</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="ietm-app-footer">
          <IETMAppFooter
            status={resolveFooterStatus(
              props.footerStatusOverride,
              props.editable,
            )}
          />
        </footer>

        {/* The backdrop for old menu is no longer needed */}
      </div>
    );
  },
);
