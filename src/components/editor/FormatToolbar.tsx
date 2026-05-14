import type { Editor } from "@tiptap/core";
import { useEffect, useReducer } from "react";

import {
  insertFilmFromSchema,
  insertImageFromSchema,
  insertLevelledParaFromSchema,
  insertRandomOrAttentionListFromSchema,
  insertSequentialListFromSchema,
  insertTableFromSchema,
  print,
  save,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { useDescriptionSchemaStore } from "../../store/descriptionSchemaStore";
import {
  List,
  ListOrdered,
  Table,
  Undo2,
  Redo2,
  Film,
  Image,
  Pilcrow,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  Subscript,
  Superscript,
  Save,
} from "lucide-react";
import { Button } from "@arco-design/web-react";

import {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";
import { TableEditToolbar } from "./TableEditToolbar";

type MainTabKey = "file" | "edit" | "insert";

interface FormatToolbarProps {
  editor: Editor;
  activeTabKey: MainTabKey;
}

export function FormatToolbar({ editor, activeTabKey }: FormatToolbarProps) {
  const schema = useDescriptionSchemaStore((s) => s.schema);
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onTxn = () => {
      refresh();
    };
    editor.on("transaction", onTxn);
    return () => {
      editor.off("transaction", onTxn);
    };
  }, [editor]);

  const textAttrs = editor.getAttributes("textStyle") as {
    fontFamily?: string | null;
    fontSize?: string | null;
    color?: string | null;
    backgroundColor?: string | null;
  };

  const highlightAttrs = editor.getAttributes("highlight") as {
    color?: string | null;
  };

  const alignLeft =
    editor.isActive({ textAlign: "left" }) ||
    (!editor.isActive({ textAlign: "center" }) &&
      !editor.isActive({ textAlign: "right" }) &&
      !editor.isActive({ textAlign: "justify" }));

  const subscriptActive = editor.isActive("s1000dSub");
  const superscriptActive = editor.isActive("s1000dSup");

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

  return (
    <div className="ietm-format-toolbar" aria-label="格式工具栏">
      <div
        className="ietm-format-toolbar__cluster"
        style={{ display: showTableTools ? "none" : undefined }}
      >
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="撤销"
        >
          <Undo2 size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="重做"
        >
          <Redo2 size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => save(editor)}
          title="保存"
        >
          <Save size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertLevelledParaFromSchema(editor, schema)}
          title="插入段落"
          aria-label="插入段落"
        >
          <Pilcrow size={16} aria-hidden className="shrink-0" />
        </button>

        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertSequentialListFromSchema(editor, schema)}
          title="插入有序列表（sequentialList）"
          aria-label="插入有序列表"
        >
          <ListOrdered size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertRandomOrAttentionListFromSchema(editor, schema)}
          title="插入无序列表（randomList / attentionRandomList）"
          aria-label="插入无序列表"
        >
          <List size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertTableFromSchema(editor, schema, 4, 1, 3)}
          title="插入表格（S1000D：title?、tgroup、thead?、tbody、row+、entry+、para+）"
        >
          <Table size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertImageFromSchema(editor, schema)}
          title="插入图片"
          aria-label="插入图片"
        >
          <Image size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertFilmFromSchema(editor, schema)}
          title="插入多媒体"
          aria-label="插入多媒体"
        >
          <Film size={16} aria-hidden className="shrink-0" />
        </button>
      </div>

      <span
        className="ietm-format-toolbar__divider"
        style={{ display: showTableTools ? "none" : undefined }}
      />

      <span
        className="ietm-format-toolbar__divider"
        style={{ display: showTableTools ? "none" : undefined }}
      />

      {showTableTools ? (
        <TableEditToolbar
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
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive("italic") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive("underline") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <span className="ietm-underline-label">U</span>
        </button>

        <label className="ietm-color-swatch" title="文字颜色">
          <span className="ietm-color-swatch__glyph">A</span>
          <input
            type="color"
            value={rgbToHex(textAttrs.color ?? "#1f2330")}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
          />
        </label>

        <label
          className="ietm-color-swatch ietm-color-swatch--highlight"
          title="背景色"
        >
          <span className="ietm-highlight-icon">▮</span>
          <input
            type="color"
            value={rgbToHex(highlightAttrs.color ?? "#fef08a")}
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .setHighlight({ color: e.target.value })
                .run()
            }
          />
        </label>
      </div>

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
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="左对齐"
        >
          <TextAlignStart size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: "center" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="居中"
        >
          <TextAlignCenter size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: "right" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="右对齐"
        >
          <TextAlignEnd size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: "justify" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          title="两端对齐"
        >
          <TextAlignJustify size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${subscriptActive ? "is-active" : ""}`}
          onClick={toggleSubscript}
          title="下标"
          aria-pressed={subscriptActive}
        >
          <Subscript size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${superscriptActive ? "is-active" : ""}`}
          onClick={toggleSuperscript}
          title="上标"
          aria-pressed={superscriptActive}
        >
          <Superscript size={16} aria-hidden className="shrink-0" />
        </button>
        <Button type="primary" onClick={() => print(editor)}>
          导出 XML
        </Button>
      </div>
    </div>
  );
}

function rgbToHex(color: string): string {
  const s = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "#1f2330";
  const r = Number(m[1]).toString(16).padStart(2, "0");
  const g = Number(m[2]).toString(16).padStart(2, "0");
  const b = Number(m[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
