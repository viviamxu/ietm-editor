import type { Editor } from "@tiptap/core";
import { Table } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { insertTableFromSchema } from "../../lib/s1000d/descriptionSchemaInsert";
import type { DescriptionSchema } from "../../types/descriptionSchema";

const GRID_MAX = 10;
const MAX_COLS = 32;
const MAX_ROWS = 100;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 4;

export function resolveInsertTableDims(
  rows: number,
  cols: number,
  includeHeader: boolean,
): { cols: number; headerRowCount: number; bodyRows: number } {
  const safeCols = Math.min(MAX_COLS, Math.max(1, Math.floor(cols)));
  const safeRows = Math.min(MAX_ROWS, Math.max(1, Math.floor(rows)));
  const headerRowCount = includeHeader ? 1 : 0;
  const bodyRows = includeHeader ? Math.max(1, safeRows - 1) : safeRows;
  return { cols: safeCols, headerRowCount, bodyRows };
}

function clampRows(n: number): number {
  return Math.min(MAX_ROWS, Math.max(1, Math.floor(n) || 1));
}

function clampCols(n: number): number {
  return Math.min(MAX_COLS, Math.max(1, Math.floor(n) || 1));
}

interface InsertTablePickerProps {
  editor: Editor;
  schema: DescriptionSchema;
  disabled?: boolean;
}

export function InsertTablePicker({
  editor,
  schema,
  disabled = false,
}: InsertTablePickerProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [includeHeader, setIncludeHeader] = useState(true);

  const close = useCallback(() => setOpen(false), []);

  const handleCreate = useCallback(() => {
    const dims = resolveInsertTableDims(rows, cols, includeHeader);
    if (
      insertTableFromSchema(
        editor,
        schema,
        dims.cols,
        dims.headerRowCount,
        dims.bodyRows,
      )
    ) {
      close();
    }
  }, [rows, cols, includeHeader, editor, schema, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const previewRows = Math.min(rows, GRID_MAX);
  const previewCols = Math.min(cols, GRID_MAX);

  return (
    <div className="ietm-insert-table-picker-wrap" ref={rootRef}>
      <button
        type="button"
        className={`ietm-icon-btn ${open ? "is-active" : ""}`}
        disabled={disabled}
        title="插入表格"
        aria-label="插入表格"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <Table size={16} aria-hidden className="shrink-0" />
      </button>

      {open ? (
        <div
          id={panelId}
          className="ietm-insert-table-picker"
          role="dialog"
          aria-label="插入表格"
          onMouseDown={(e) => e.preventDefault()}
        >
          <header className="ietm-insert-table-picker__header">
            <span className="ietm-insert-table-picker__title">插入表格</span>
            <label className="ietm-insert-table-picker__header-toggle">
              <span>包含表头</span>
              <button
                type="button"
                role="switch"
                className="ietm-insert-table-picker__switch"
                aria-checked={includeHeader}
                onClick={() => setIncludeHeader((v) => !v)}
              >
                <span className="ietm-insert-table-picker__switch-thumb" />
              </button>
            </label>
          </header>

          <div
            className="ietm-insert-table-picker__grid"
            role="grid"
            aria-label={`${rows} 行 ${cols} 列`}
          >
            {Array.from({ length: GRID_MAX }, (_, ri) =>
              Array.from({ length: GRID_MAX }, (_, ci) => {
                const r = ri + 1;
                const c = ci + 1;
                const selected = r <= previewRows && c <= previewCols;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className={`ietm-insert-table-picker__cell${selected ? " is-selected" : ""}`}
                    aria-label={`${r} 行 ${c} 列`}
                    onMouseEnter={() => {
                      setRows(r);
                      setCols(c);
                    }}
                    onClick={handleCreate}
                  />
                );
              }),
            )}
          </div>

          <p className="ietm-insert-table-picker__hint" aria-live="polite">
            {rows} × {cols} 表格
          </p>
          {/* 
          <div className="ietm-insert-table-picker__dims">
            <label className="ietm-insert-table-picker__dim">
              <span>行数：</span>
              <input
                type="number"
                min={1}
                max={MAX_ROWS}
                value={rows}
                onChange={(e) => setRows(clampRows(Number(e.target.value)))}
              />
            </label>
            <label className="ietm-insert-table-picker__dim">
              <span>列数：</span>
              <input
                type="number"
                min={1}
                max={MAX_COLS}
                value={cols}
                onChange={(e) => setCols(clampCols(Number(e.target.value)))}
              />
            </label>
          </div> */}
          {/* 
          <button
            type="button"
            className="ietm-insert-table-picker__submit"
            onClick={handleCreate}
          >
            创建表格
          </button> */}
        </div>
      ) : null}
    </div>
  );
}
