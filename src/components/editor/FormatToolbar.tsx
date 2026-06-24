import type { Editor } from "@tiptap/core";
import { useEffect, useReducer, useState } from "react";

import {
  insertFilmFromSchema,
  insertImageFromSchema,
  insertSymbolFromSchema,
  insertLevelledParaFromSchema,
  insertParagraphFromSchema,
  insertRandomOrAttentionListFromSchema,
  insertSequentialListFromSchema,
  insertWarningFromSchema,
  insertCautionFromSchema,
  insertNoteFromSchema,
  canInsertWarningFromSchema,
  canInsertCautionFromSchema,
  canInsertNoteFromSchema,
  canInsertSymbolFromSchema,
  exportEditorToDmXmlString,
  save,
  internalRef,
  insertExternalRefFromSchema,
  clearContent,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { getDmContentKind } from "../../lib/s1000d/dmContentKind";
import {
  insertFaultIsolationFromSchema,
  insertIsolationProcedureEndAtCursor,
  insertIsolationStepAtCursor,
} from "../../lib/s1000d/faultIsolationInsert";
import { insertProceduralStepAtCursor } from "../../lib/s1000d/procedureInsert";
import { useDescriptionSchemaStore } from "../../store/descriptionSchemaStore";
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";
import {
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Film,
  Image,
  Omega,
  Pilcrow,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  Subscript,
  Superscript,
  Save,
  Link2,
  ExternalLink,
  CircleX,
  LockKeyhole,
  LockKeyholeOpen,
  CircleAlert,
  TriangleAlert,
  SquarePilcrow,
  Strikethrough as StrikethroughIcon,
  Outdent,
  Indent,
  ListCollapse,
  ListEnd,
  ListTree,
} from "lucide-react";

import {
  canDemoteNesting,
  demoteNesting,
} from "../../lib/editor/demoteNesting";
import {
  canPromoteNesting,
  promoteNesting,
} from "../../lib/editor/promoteNesting";
import {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";
import { useToolbarConfigStore } from "../../store/toolbarConfigStore";
import { isEditorComposing } from "../../lib/editor/imeComposition";
import { deferEditorMutation } from "../../lib/editor/deferEditorMutation";
import type {
  BuiltinToolbarItemId,
  ToolbarItemContext,
  ToolbarTab,
} from "../../types/toolbar";
import { InsertTablePicker } from "./InsertTablePicker";
import { TableEditToolbar } from "./TableEditToolbar";
import { ToolbarCustomItems } from "./ToolbarCustomItems";

type MainTabKey = ToolbarTab;

interface FormatToolbarProps {
  editor: Editor;
  activeTabKey: MainTabKey;
  editable: boolean;
  onEditableChange: (editable: boolean) => void;
  onSaveDmXml?: SaveDmXmlHandler;
  /** 保存成功（宿主回调或本地下载）后触发，用于刷新已打开的预览等 */
  onAfterSave?: () => void;
  /** 可编辑状态下「锁定」按钮的 `title`；默认「锁定（只读）」 */
  lockReadonlyButtonTitle?: string;
  /** 只读状态下「编辑」按钮的 `title`；默认「编辑」 */
  editModeButtonTitle?: string;
}

const DEFAULT_LOCK_READONLY_TITLE = "锁定（只读）";
const DEFAULT_EDIT_MODE_TITLE = "编辑";

export function FormatToolbar({
  editor,
  activeTabKey,
  editable,
  onEditableChange,
  onSaveDmXml,
  onAfterSave,
  lockReadonlyButtonTitle = DEFAULT_LOCK_READONLY_TITLE,
  editModeButtonTitle = DEFAULT_EDIT_MODE_TITLE,
}: FormatToolbarProps) {
  const schema = useDescriptionSchemaStore((s) => s.schema);
  const contentKind = getDmContentKind(schema);
  const isDescriptionDm = contentKind === "description";
  const isProcedureDm = contentKind === "procedure";
  const isFaultDm = contentKind === "faultIsolation";
  const isIpdDm = contentKind === "ipd";
  const isRichTextDm = isDescriptionDm || isProcedureDm;
  const hideBuiltinItems = useToolbarConfigStore((s) => s.hideBuiltinItems);
  const onInsertExternalRefClick = useToolbarConfigStore(
    (s) => s.onInsertExternalRefClick,
  );
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [saveInFlight, setSaveInFlight] = useState(false);
  useEffect(() => {
    const onTxn = () => {
      if (isEditorComposing(editor)) return;
      deferEditorMutation(refresh);
    };
    const onSelection = () => {
      if (isEditorComposing(editor)) return;
      deferEditorMutation(refresh);
    };
    editor.on("transaction", onTxn);
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("transaction", onTxn);
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor]);

  const alignLeft =
    editor.isActive({ textAlign: "left" }) ||
    (!editor.isActive({ textAlign: "center" }) &&
      !editor.isActive({ textAlign: "right" }) &&
      !editor.isActive({ textAlign: "justify" }));

  const subscriptActive = editor.isActive("s1000dSub");
  const superscriptActive = editor.isActive("s1000dSup");
  const overlineActive = editor.isActive("overline");
  const strikethroughActive = editor.isActive("strikethrough");
  const demoteEnabled = canDemoteNesting(editor);
  const promoteEnabled = canPromoteNesting(editor);
  const canInsertWarning = canInsertWarningFromSchema(editor, schema);
  const canInsertCaution = canInsertCautionFromSchema(editor, schema);
  const canInsertNote = canInsertNoteFromSchema(editor, schema);
  const canInsertSymbol = canInsertSymbolFromSchema(editor, schema);

  const toggleSubscript = () => {
    const chain = editor.chain().focus().unsetMark("s1000dSup");
    if (subscriptActive) {
      chain.unsetMark("s1000dSub").run();
    } else {
      chain.setMark("s1000dSub").run();
    }
  };

  const toggleSuperscript = () => {
    const chain = editor.chain().focus().unsetMark("s1000dSub");
    if (superscriptActive) {
      chain.unsetMark("s1000dSup").run();
    } else {
      chain.setMark("s1000dSup").run();
    }
  };

  const showTableTools = activeTabKey === "edit";

  const runTableAction = (
    action: Parameters<typeof runS1000dTableAction>[1],
  ) => {
    runS1000dTableAction(editor, action);
  };

  const tableActionDisabled = (
    action: Parameters<typeof canRunS1000dTableAction>[1],
  ) => !canRunS1000dTableAction(editor, action);

  const runHostOrDownloadSave = () => {
    if (onSaveDmXml) {
      void (async () => {
        setSaveInFlight(true);
        try {
          await Promise.resolve(onSaveDmXml(exportEditorToDmXmlString(editor)));
          onAfterSave?.();
        } finally {
          setSaveInFlight(false);
        }
      })();
      return;
    }
    save(editor);
    onAfterSave?.();
  };

  /** 只读时除「切换为可编辑」外，工具栏其余控件均不可点 */
  const formatBarLocked = !editable;

  const toolbarCtx: ToolbarItemContext = {
    editor,
    editable,
    activeTabKey,
    formatBarLocked,
  };

  const isBuiltinVisible = (id: BuiltinToolbarItemId) =>
    !hideBuiltinItems?.includes(id);

  const runInsertImage = () => {
    insertImageFromSchema(editor, schema);
  };

  const runInsertFilm = () => {
    insertFilmFromSchema(editor, schema);
  };

  const runInsertSymbol = () => {
    insertSymbolFromSchema(editor, schema);
  };

  const runInsertExternalRef = () => {
    if (onInsertExternalRefClick) {
      onInsertExternalRefClick(toolbarCtx);
      return;
    }
    insertExternalRefFromSchema(editor, schema);
  };

  if (isIpdDm) {
    return (
      <div className="ietm-format-toolbar" aria-label="格式工具栏">
        <div className="ietm-format-toolbar__cluster">
          {editable && isBuiltinVisible("lockReadonly") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              title={lockReadonlyButtonTitle}
              aria-label="锁定，切换为只读"
              onClick={() => onEditableChange(false)}
            >
              <LockKeyhole size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {!editable && isBuiltinVisible("editMode") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              title={editModeButtonTitle}
              aria-label="编辑，切换为可编辑"
              onClick={() => {
                onEditableChange(true);
                queueMicrotask(() => {
                  editor.chain().focus().run();
                });
              }}
            >
              <LockKeyholeOpen size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          <ToolbarCustomItems placement="editToggle" ctx={toolbarCtx} />
          {isBuiltinVisible("undo") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || !editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
              title="撤销"
            >
              <Undo2 size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("redo") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || !editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
              title="重做"
            >
              <Redo2 size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("save") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || saveInFlight}
              onClick={runHostOrDownloadSave}
              title="保存"
            >
              <Save size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("clearContent") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={() => clearContent(editor, schema)}
              title="清空内容"
            >
              <CircleX size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("insertImage") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={runInsertImage}
              title="插入图片"
              aria-label="插入图片"
            >
              <Image size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("insertFilm") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={runInsertFilm}
              title="插入多媒体"
              aria-label="插入多媒体"
            >
              <Film size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
          {isBuiltinVisible("insertSymbol") ? (
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || !canInsertSymbol}
              onMouseDown={(e) => e.preventDefault()}
              onClick={runInsertSymbol}
              title="插入符号"
              aria-label="插入符号"
            >
              <Omega size={16} aria-hidden className="shrink-0" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ietm-format-toolbar" aria-label="格式工具栏">
      <div
        className="ietm-format-toolbar__cluster"
        style={{ display: showTableTools ? "none" : undefined }}
      >
        {editable && isBuiltinVisible("lockReadonly") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            title={lockReadonlyButtonTitle}
            aria-label="锁定，切换为只读"
            onClick={() => onEditableChange(false)}
          >
            <LockKeyhole size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {!editable && isBuiltinVisible("editMode") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            title={editModeButtonTitle}
            aria-label="编辑，切换为可编辑"
            onClick={() => {
              onEditableChange(true);
              queueMicrotask(() => {
                editor.chain().focus().run();
              });
            }}
          >
            <LockKeyholeOpen size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        <ToolbarCustomItems placement="editToggle" ctx={toolbarCtx} />
        {isBuiltinVisible("undo") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="撤销"
          >
            <Undo2 size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("redo") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="重做"
          >
            <Redo2 size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("save") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked || saveInFlight}
            onClick={runHostOrDownloadSave}
            title="保存"
          >
            <Save size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("clearContent") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={() => clearContent(editor, schema)}
            title="清空内容"
          >
            <CircleX size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isFaultDm ? (
          <>
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={() => insertFaultIsolationFromSchema(editor, schema)}
              title="插入隔离程序"
              aria-label="插入隔离程序"
            >
              <ListCollapse size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={() => insertIsolationStepAtCursor(editor)}
              title="插入隔离步骤"
              aria-label="插入隔离步骤"
            >
              <ListTree size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={() => insertIsolationProcedureEndAtCursor(editor)}
              title="插入隔离结束"
              aria-label="插入隔离结束"
            >
              <ListEnd size={16} aria-hidden className="shrink-0" />
            </button>
          </>
        ) : null}
        {isProcedureDm ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertProceduralStepAtCursor(editor)}
            title="插入程序步骤（proceduralStep）"
            aria-label="插入程序步骤"
          >
            <SquarePilcrow size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isDescriptionDm && isBuiltinVisible("insertLevelledPara") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertLevelledParaFromSchema(editor, schema)}
            title="在当前节下插入子层级段落"
            aria-label="在当前节下插入子层级段落"
          >
            <SquarePilcrow size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isRichTextDm ? (
          <>
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || !promoteEnabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => promoteNesting(editor)}
              title="升级（变浅层级，如三级→二级）"
              aria-label="升级"
            >
              <Indent size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked || !demoteEnabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => demoteNesting(editor)}
              title="降级（加深层级，如二级→三级）"
              aria-label="降级"
            >
              <Outdent size={16} aria-hidden className="shrink-0" />
            </button>
          </>
        ) : null}

        {isRichTextDm && isBuiltinVisible("insertSequentialList") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={() => insertSequentialListFromSchema(editor, schema)}
            title="插入有序列表（sequentialList）"
            aria-label="插入有序列表"
          >
            <ListOrdered size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("insertRandomList") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              insertRandomOrAttentionListFromSchema(editor, schema)
            }
            title="插入无序列表（randomList / attentionRandomList）"
            aria-label="插入无序列表"
          >
            <List size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("insertTable") ? (
          <InsertTablePicker
            editor={editor}
            schema={schema}
            disabled={formatBarLocked}
          />
        ) : null}
        {isBuiltinVisible("insertImage") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={runInsertImage}
            title="插入图片"
            aria-label="插入图片"
          >
            <Image size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("insertFilm") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={runInsertFilm}
            title="插入多媒体"
            aria-label="插入多媒体"
          >
            <Film size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("insertSymbol") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked || !canInsertSymbol}
            onMouseDown={(e) => e.preventDefault()}
            onClick={runInsertSymbol}
            title="插入符号"
            aria-label="插入符号"
          >
            <Omega size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isRichTextDm ? (
          <>
            <ToolbarCustomItems placement="insert" ctx={toolbarCtx} />
            <button
              type="button"
              className="ietm-icon-btn"
              disabled={formatBarLocked}
              onClick={() => insertParagraphFromSchema(editor, schema)}
              title="插入段落"
              aria-label="插入段落"
            >
              <Pilcrow size={16} aria-hidden className="shrink-0" />
            </button>
          </>
        ) : null}
      </div>

      <span
        className="ietm-format-toolbar__divider"
        style={{ display: showTableTools ? "none" : undefined }}
      />

      {showTableTools ? (
        <TableEditToolbar
          readOnly={formatBarLocked}
          tableActionDisabled={tableActionDisabled}
          runTableAction={runTableAction}
        />
      ) : null}

      <div
        className="ietm-format-toolbar__cluster"
        style={{ display: showTableTools ? "none" : undefined }}
      >
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive("bold") ? "is-active" : ""}`}
          disabled={formatBarLocked}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive("italic") ? "is-active" : ""}`}
          disabled={formatBarLocked}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive("underline") ? "is-active" : ""}`}
          disabled={formatBarLocked}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <span className="ietm-underline-label">U</span>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${overlineActive ? "is-active" : ""}`}
          disabled={formatBarLocked}
          onClick={() => editor.chain().focus().toggleMark("overline").run()}
          title="上横线"
          aria-pressed={overlineActive}
        >
          <span className="ietm-overline-label">A</span>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${strikethroughActive ? "is-active" : ""}`}
          disabled={formatBarLocked}
          onClick={() =>
            editor.chain().focus().toggleMark("strikethrough").run()
          }
          title="删除线"
          aria-pressed={strikethroughActive}
        >
          <StrikethroughIcon size={16} aria-hidden className="shrink-0" />
        </button>
      </div>

      {isRichTextDm ? (
        <>
          <span
            className="ietm-format-toolbar__divider"
            style={{ display: showTableTools ? "none" : undefined }}
          />
          <div
            className="ietm-format-toolbar__cluster"
            style={{ display: showTableTools ? "none" : undefined }}
          >
            <button
              type="button"
              className={`ietm-toggle-btn ${alignLeft ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              title="左对齐"
            >
              <TextAlignStart size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className={`ietm-toggle-btn ${editor.isActive({ textAlign: "center" }) ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              title="居中"
            >
              <TextAlignCenter size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className={`ietm-toggle-btn ${editor.isActive({ textAlign: "right" }) ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              title="右对齐"
            >
              <TextAlignEnd size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className={`ietm-toggle-btn ${editor.isActive({ textAlign: "justify" }) ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              title="两端对齐"
            >
              <TextAlignJustify size={16} aria-hidden className="shrink-0" />
            </button>
          </div>
        </>
      ) : null}
      <div className="ietm-format-toolbar__cluster">
        {!showTableTools ? (
          <>
            <button
              type="button"
              className={`ietm-toggle-btn ${subscriptActive ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={toggleSubscript}
              title="下标"
              aria-pressed={subscriptActive}
            >
              <Subscript size={16} aria-hidden className="shrink-0" />
            </button>
            <button
              type="button"
              className={`ietm-toggle-btn ${superscriptActive ? "is-active" : ""}`}
              disabled={formatBarLocked}
              onClick={toggleSuperscript}
              title="上标"
              aria-pressed={superscriptActive}
            >
              <Superscript size={16} aria-hidden className="shrink-0" />
            </button>
          </>
        ) : null}
        <ToolbarCustomItems placement="format" ctx={toolbarCtx} />
      </div>
      <span
        className="ietm-format-toolbar__divider"
        style={{ display: showTableTools ? "none" : undefined }}
      />
      <div
        className="ietm-format-toolbar__cluster"
        style={{ display: showTableTools ? "none" : undefined }}
      >
        {isBuiltinVisible("internalRef") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={() => internalRef(editor)}
            title="内部引用"
            aria-label="内部引用"
          >
            <Link2 size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        {isBuiltinVisible("insertExternalRef") ? (
          <button
            type="button"
            className="ietm-icon-btn"
            disabled={formatBarLocked}
            onClick={runInsertExternalRef}
            title="插入外部引用"
            aria-label="插入外部引用"
          >
            <ExternalLink size={16} aria-hidden className="shrink-0" />
          </button>
        ) : null}
        <ToolbarCustomItems placement="reference" ctx={toolbarCtx} />
      </div>
      <span
        className="ietm-format-toolbar__divider"
        style={{ display: showTableTools ? "none" : undefined }}
      />
      <div style={{ display: showTableTools ? "none" : undefined }}>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={formatBarLocked || !canInsertWarning}
          onClick={() => insertWarningFromSchema(editor, schema)}
          title="插入警告（warning）"
          aria-label="插入警告"
        >
          <TriangleAlert
            size={16}
            aria-hidden
            className="shrink-0 text-red-500"
          />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={formatBarLocked || !canInsertCaution}
          onClick={() => insertCautionFromSchema(editor, schema)}
          title="插入注意（caution）"
          aria-label="插入注意"
        >
          <TriangleAlert
            size={16}
            aria-hidden
            className="shrink-0 text-yellow-500"
          />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={formatBarLocked || !canInsertNote}
          onClick={() => insertNoteFromSchema(editor, schema)}
          title="插入注（note）"
          aria-label="插入注"
        >
          <CircleAlert size={16} aria-hidden className="shrink-0" />
        </button>
      </div>

      <ToolbarCustomItems placement="format" ctx={toolbarCtx} />
    </div>
  );
}
