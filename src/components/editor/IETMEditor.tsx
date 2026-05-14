import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent,
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
import {
  getDescriptionInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
  s1000dPhase1Nodes,
} from "../../extensions/S1000DNodes";
import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";
import bikeDmSampleXml from "../../data/bikeDmSample.xml?raw";
import { FormatToolbar } from "./FormatToolbar";
import {
  resolveInspectable,
  tableDimensions,
  type InspectTarget,
} from "../../lib/editor/resolveInspectable";
import {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";
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
} from "lucide-react";

export interface InsertTableOptions {
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}

export interface IETMEditorRefValue {
  setContent: (content: JSONContent | string) => void;
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
  onUpdate: (json: JSONContent) => void;
  onSelectionChange: (range: { from: number; to: number }) => void;
  onReady: () => void;
}

const DEFAULT_CONTENT_FROM_BIKE_DM_XML =
  getDescriptionInnerXmlFromDmXml(bikeDmSampleXml);

function normalizeEditorContentInput(
  content: JSONContent | string | undefined,
): JSONContent | string | undefined {
  if (typeof content !== "string") return content;
  return preprocessS1000dDescriptionHtmlFragment(content);
}

const FALLBACK_DOCUMENT: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "（未能从 Bike DM XML 解析出 description，请检查 data/bikeDmSample.xml）",
        },
      ],
    },
  ],
};

const DOC_TITLE_PLACEHOLDER = "数据模块标题 DMC-XXXX-XX-XXXX-XX-A-D";

const UNIT_PRESETS = ["ph01(h)", "mm", "in", "deg"];

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
        IETMImage.configure({
          resize: false,
        }),
        ...s1000dPhase1Nodes,
      ],
      content:
        normalizeEditorContentInput(props.initialContent) ??
        DEFAULT_CONTENT_FROM_BIKE_DM_XML ??
        FALLBACK_DOCUMENT,
      editorProps: {
        attributes: {
          class: "ietm-tiptap-root",
          spellcheck: "false",
        },
      },
      onUpdate: ({ editor }) => props.onUpdate(editor.getJSON()),
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

    const showPropertyPanel = resolvedTarget !== null && !propertiesDismissed;

    const inspectStableKey = resolvedTarget
      ? `${resolvedTarget.kind}-${resolvedTarget.pos}`
      : null;

    useEffect(() => {
      if (inspectStableKey === null) setPropertiesDismissed(false);
    }, [inspectStableKey]);

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

    const applyImageAttrs = (attrs: Record<string, unknown>) => {
      if (!resolvedTarget || resolvedTarget.kind !== "image") return;
      editor
        .chain()
        .focus()
        .setNodeSelection(resolvedTarget.pos)
        .updateAttributes("image", attrs)
        .run();
    };

    const runTableAction = (
      action: Parameters<typeof runS1000dTableAction>[1],
    ) => {
      runS1000dTableAction(editor, action);
    };

    const tableActionDisabled = (
      action: Parameters<typeof canRunS1000dTableAction>[1],
    ) => !canRunS1000dTableAction(editor, action);

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
                        disabled={tableActionDisabled("insertRowAbove")}
                        onClick={() => runTableAction("insertRowAbove")}
                        title="上方插入行"
                        aria-label="上方插入行"
                      >
                        <BetweenVerticalStart size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("insertRowBelow")}
                        onClick={() => runTableAction("insertRowBelow")}
                        title="下方插入行"
                        aria-label="下方插入行"
                      >
                        <BetweenVerticalEnd size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("deleteRow")}
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
                        disabled={tableActionDisabled("insertColLeft")}
                        onClick={() => runTableAction("insertColLeft")}
                        title="左侧插入列"
                        aria-label="左侧插入列"
                      >
                        <BetweenHorizontalStart size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("insertColRight")}
                        onClick={() => runTableAction("insertColRight")}
                        title="右侧插入列"
                        aria-label="右侧插入列"
                      >
                        <BetweenHorizontalEnd size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("deleteCol")}
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
                        disabled={tableActionDisabled("mergeCells")}
                        onClick={() => runTableAction("mergeCells")}
                        title="合并单元格"
                        aria-label="合并单元格"
                      >
                        <Combine size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("splitCell")}
                        onClick={() => runTableAction("splitCell")}
                        title="拆分单元格"
                        aria-label="拆分单元格"
                      >
                        <Split size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("deleteCell")}
                        onClick={() => runTableAction("deleteCell")}
                        title="删除单元格"
                        aria-label="删除单元格"
                      >
                        <TableCellsSplit size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("clearCell")}
                        onClick={() => runTableAction("clearCell")}
                        title="清空单元格"
                        aria-label="清空单元格"
                      >
                        <Eraser size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ietm-menu-icon-btn"
                        disabled={tableActionDisabled("deleteTable")}
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
                    onClick={() => {
                      insertTable();
                    }}
                  >
                    插入表格
                  </button>
                  <button
                    type="button"
                    className="ietm-menu-item"
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

          <FormatToolbar editor={editor} activeTabKey={activeTabKey} />
        </div>

        <div className="ietm-app-main">
          <div
            className="ietm-editor-pane"
            onMouseDown={handleEditorPaneMouseDown}
          >
            <EditorContent editor={editor} className="ietm-editor-surface" />
          </div>

          <aside className="ietm-right-pane">
            {showPropertyPanel && resolvedTarget ? (
              <div className="ietm-property-panel">
                <div className="ietm-property-panel__head">
                  <h2 className="ietm-property-panel__title">属性设置</h2>
                  <button
                    type="button"
                    className="ietm-property-panel__close"
                    onClick={() => setPropertiesDismissed(true)}
                    aria-label="关闭属性面板"
                  >
                    ×
                  </button>
                </div>
                <div className="ietm-property-panel__body">
                  {resolvedTarget.kind === "image" ? (
                    <>
                      <label className="ietm-prop-field">
                        <span>ID</span>
                        <input
                          type="text"
                          value={String(resolvedTarget.attrs.figureId ?? "")}
                          onChange={(e) =>
                            applyImageAttrs({ figureId: e.target.value })
                          }
                        />
                      </label>
                      <label className="ietm-prop-field">
                        <span>unitOfMeasure</span>
                        <select
                          value={String(
                            resolvedTarget.attrs.unitOfMeasure ?? "",
                          )}
                          onChange={(e) =>
                            applyImageAttrs({
                              unitOfMeasure: e.target.value,
                            })
                          }
                        >
                          {UNIT_PRESETS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="ietm-prop-field">
                        <span>宽度（px）</span>
                        <input
                          type="text"
                          value={
                            resolvedTarget.attrs.width != null
                              ? String(resolvedTarget.attrs.width)
                              : ""
                          }
                          placeholder="自动"
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            const n = Number.parseInt(v, 10);
                            applyImageAttrs({
                              width: v === "" || Number.isNaN(n) ? null : n,
                            });
                          }}
                        />
                      </label>
                      <label className="ietm-prop-field">
                        <span>高度（px）</span>
                        <input
                          type="text"
                          value={
                            resolvedTarget.attrs.height != null
                              ? String(resolvedTarget.attrs.height)
                              : ""
                          }
                          placeholder="自动"
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            const n = Number.parseInt(v, 10);
                            applyImageAttrs({
                              height: v === "" || Number.isNaN(n) ? null : n,
                            });
                          }}
                        />
                      </label>
                    </>
                  ) : null}

                  {resolvedTarget.kind === "table" ? (
                    <>
                      <p className="ietm-prop-hint">
                        表格结构与样式可通过编辑器直接调整。
                      </p>
                      {(() => {
                        const dim = tableDimensions(editor, resolvedTarget.pos);
                        return dim ? (
                          <>
                            <div className="ietm-prop-readonly">
                              <span>行数</span>
                              <span>{dim.rows}</span>
                            </div>
                            <div className="ietm-prop-readonly">
                              <span>列数</span>
                              <span>{dim.cols}</span>
                            </div>
                          </>
                        ) : null;
                      })()}
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="ietm-preview-placeholder">
                <p>功能开发中，敬请期待</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="ietm-app-footer">
          <span className="ietm-save-status">
            <span className="ietm-save-status__icon" aria-hidden>
              ✓
            </span>
            已保存
          </span>
        </footer>

        {/* The backdrop for old menu is no longer needed */}
      </div>
    );
  },
);
