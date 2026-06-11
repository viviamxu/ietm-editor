import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import {
  clearTableCellSelection,
  resolveCellContext,
  resolveCommandRange,
  resolvePrimaryCellContext,
  type TableCellContext,
} from "./tableSelection";

type TableAction =
  | "insertRowAbove"
  | "insertRowBelow"
  | "deleteRow"
  | "toggleHeader"
  | "insertColLeft"
  | "insertColRight"
  | "deleteCol"
  | "mergeCells"
  | "splitCell"
  | "deleteCell"
  | "clearCell"
  | "deleteTable";

const emptyParaJson = { type: "para" };

function createEmptyEntry(editor: Editor) {
  return editor.schema.nodeFromJSON({
    type: "entry",
    content: [emptyParaJson],
  });
}

function createEmptyRow(editor: Editor, cols: number) {
  const entries = Array.from({ length: Math.max(1, cols) }, () =>
    createEmptyEntry(editor),
  );
  return editor.schema.nodes.row.create(null, entries);
}

function colNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^col(\d+)$/.exec(value);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isNaN(n) ? null : n;
}

function entryColSpan(entry: PMNode): number {
  const start = colNumber(entry.attrs.namest);
  const end = colNumber(entry.attrs.nameend);
  if (start != null && end != null && end >= start) return end - start + 1;
  return 1;
}

function entryRowSpan(entry: PMNode): number {
  const raw = Number.parseInt(String(entry.attrs.morerows ?? "0"), 10);
  return Number.isNaN(raw) ? 1 : Math.max(1, raw + 1);
}

function tgroupColumnCount(tgroup: PMNode): number {
  const attrCols = Number.parseInt(String(tgroup.attrs.cols ?? ""), 10);
  let max = Number.isNaN(attrCols) ? 0 : attrCols;
  tgroup.forEach((section) => {
    if (section.type.name !== "thead" && section.type.name !== "tbody") return;
    section.forEach((row) => {
      if (row.type.name !== "row") return;
      let cols = 0;
      row.forEach((entry) => {
        if (entry.type.name === "entry") cols += entryColSpan(entry);
      });
      max = Math.max(max, cols);
    });
  });
  return Math.max(1, max);
}

function contentArray(node: PMNode): PMNode[] {
  const out: PMNode[] = [];
  node.forEach((child) => out.push(child));
  return out;
}

function findTableContext(
  editor: Editor,
): Pick<TableCellContext, "table" | "tablePos"> | null {
  const cell = resolvePrimaryCellContext(editor);
  if (cell) return { table: cell.table, tablePos: cell.tablePos };

  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === "table"
  ) {
    return { table: selection.node, tablePos: selection.from };
  }
  return null;
}

function replaceTgroup(
  editor: Editor,
  ctx: TableCellContext,
  nextTgroup: PMNode,
): boolean {
  const tableChildren = contentArray(ctx.table);
  tableChildren[ctx.tgroupIndex] = nextTgroup;
  const nextTable = ctx.table.type.create(ctx.table.attrs, tableChildren);
  const tr = editor.state.tr.replaceWith(
    ctx.tablePos,
    ctx.tablePos + ctx.table.nodeSize,
    nextTable,
  );
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function clearEntry(editor: Editor, entry: PMNode) {
  return entry.type.create(entry.attrs, [editor.schema.nodes.para.create()]);
}

function clearEntrySpan(entry: PMNode) {
  return {
    ...entry.attrs,
    namest: null,
    nameend: null,
    morerows: null,
  };
}

function updateTgroupCols(tgroup: PMNode, cols: number, children: PMNode[]) {
  return tgroup.type.create(
    {
      ...tgroup.attrs,
      cols: String(Math.max(1, cols)),
    },
    children,
  );
}

function mutateSectionRows(
  tgroup: PMNode,
  sectionIndex: number,
  mutate: (rows: PMNode[], section: PMNode) => PMNode[],
): PMNode[] {
  return contentArray(tgroup).map((section, index) => {
    if (index !== sectionIndex) return section;
    return section.type.create(
      section.attrs,
      mutate(contentArray(section), section),
    );
  });
}

function insertRow(editor: Editor, below: boolean): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const cols = tgroupColumnCount(ctx.tgroup);
  const tgroupChildren = mutateSectionRows(
    ctx.tgroup,
    ctx.sectionIndex,
    (rows) => {
      const nextRows = [...rows];
      nextRows.splice(
        ctx.rowIndex + (below ? 1 : 0),
        0,
        createEmptyRow(editor, cols),
      );
      return nextRows;
    },
  );
  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, cols, tgroupChildren),
  );
}

function deleteRow(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const cols = tgroupColumnCount(ctx.tgroup);
  const tgroupChildren = contentArray(ctx.tgroup);
  const rows = contentArray(ctx.section);

  if (ctx.section.type.name === "thead" && rows.length === 1) {
    tgroupChildren.splice(ctx.sectionIndex, 1);
  } else if (rows.length === 1) {
    tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(
      ctx.section.attrs,
      [createEmptyRow(editor, cols)],
    );
  } else {
    rows.splice(ctx.rowIndex, 1);
    tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(
      ctx.section.attrs,
      rows,
    );
  }

  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, cols, tgroupChildren),
  );
}

function insertColumn(editor: Editor, right: boolean): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const cols = tgroupColumnCount(ctx.tgroup);
  const insertAt = ctx.entryIndex + (right ? 1 : 0);
  const tgroupChildren = contentArray(ctx.tgroup).map((section) => {
    if (section.type.name !== "thead" && section.type.name !== "tbody")
      return section;
    const rows = contentArray(section).map((row) => {
      const entries = contentArray(row);
      entries.splice(
        Math.min(insertAt, entries.length),
        0,
        createEmptyEntry(editor),
      );
      return row.type.create(row.attrs, entries);
    });
    return section.type.create(section.attrs, rows);
  });
  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, cols + 1, tgroupChildren),
  );
}

function deleteColumn(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const cols = tgroupColumnCount(ctx.tgroup);
  const deleteAt = ctx.entryIndex;

  if (cols <= 1) {
    return clearCell(editor);
  }

  const tgroupChildren = contentArray(ctx.tgroup).map((section) => {
    if (section.type.name !== "thead" && section.type.name !== "tbody")
      return section;
    const rows = contentArray(section).map((row) => {
      const entries = contentArray(row);
      if (entries.length > deleteAt) entries.splice(deleteAt, 1);
      if (entries.length === 0) entries.push(createEmptyEntry(editor));
      return row.type.create(row.attrs, entries);
    });
    return section.type.create(section.attrs, rows);
  });

  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, cols - 1, tgroupChildren),
  );
}

function clearCell(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const rows = contentArray(ctx.section);
  const entries = contentArray(ctx.row);
  entries[ctx.entryIndex] = clearEntry(editor, ctx.entry);
  rows[ctx.rowIndex] = ctx.row.type.create(ctx.row.attrs, entries);
  const tgroupChildren = mutateSectionRows(
    ctx.tgroup,
    ctx.sectionIndex,
    () => rows,
  );
  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, tgroupColumnCount(ctx.tgroup), tgroupChildren),
  );
}

function deleteCell(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const cols = tgroupColumnCount(ctx.tgroup);
  const rows = contentArray(ctx.section);
  const entries = contentArray(ctx.row);
  entries.splice(ctx.entryIndex, 1);
  entries.push(createEmptyEntry(editor));
  rows[ctx.rowIndex] = ctx.row.type.create(ctx.row.attrs, entries);
  const tgroupChildren = mutateSectionRows(
    ctx.tgroup,
    ctx.sectionIndex,
    () => rows,
  );
  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, cols, tgroupChildren),
  );
}

function mergeContent(editor: Editor, entries: PMNode[]) {
  const children: PMNode[] = [];
  entries.forEach((entry) => {
    entry.forEach((child) => {
      if (child.type.name !== "para" || child.textContent.trim() !== "") {
        children.push(child);
      }
    });
  });
  return children.length > 0 ? children : [editor.schema.nodes.para.create()];
}

function mergeCells(editor: Editor): boolean {
  const range = resolveCommandRange(editor);
  if (!range || range.isSingleCell) return false;

  const anchor = resolveCellContext(editor, {
    tablePos: range.tablePos,
    tgroupIndex: range.tgroupIndex,
    sectionIndex: range.sectionIndex,
    sectionType: range.sectionType,
    rowIndex: range.rowStart,
    entryIndex: range.colStart,
  });
  if (!anchor) return false;

  const { rowStart, rowEnd, colStart, colEnd } = range;
  const rowSpan = rowEnd - rowStart + 1;
  const colSpan = colEnd - colStart + 1;
  const rows = contentArray(anchor.section);
  const collected: PMNode[] = [];

  for (let r = rowStart; r <= rowEnd; r += 1) {
    const entries = contentArray(rows[r]);
    collected.push(...entries.slice(colStart, colEnd + 1));
  }

  const first = collected[0];
  const mergedEntry = first.type.create(
    {
      ...clearEntrySpan(first),
      namest: colSpan > 1 ? `col${colStart + 1}` : null,
      nameend: colSpan > 1 ? `col${colEnd + 1}` : null,
      morerows: rowSpan > 1 ? String(rowSpan - 1) : null,
    },
    mergeContent(editor, collected),
  );

  const nextRows = [...rows];
  for (let r = rowEnd; r >= rowStart; r -= 1) {
    const row = nextRows[r];
    const entries = contentArray(row);
    entries.splice(colStart, colSpan);

    if (r === rowStart) {
      entries.splice(colStart, 0, mergedEntry);
      nextRows[r] = row.type.create(row.attrs, entries);
      continue;
    }

    if (entries.length === 0) {
      nextRows.splice(r, 1);
    } else {
      nextRows[r] = row.type.create(row.attrs, entries);
    }
  }

  const tgroupChildren = mutateSectionRows(
    anchor.tgroup,
    anchor.sectionIndex,
    () => nextRows,
  );
  const merged = replaceTgroup(
    editor,
    anchor,
    updateTgroupCols(
      anchor.tgroup,
      tgroupColumnCount(anchor.tgroup),
      tgroupChildren,
    ),
  );
  if (merged) {
    clearTableCellSelection(editor);
  }
  return merged;
}

function splitCell(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  const colSpan = entryColSpan(ctx.entry);
  const rowSpan = entryRowSpan(ctx.entry);
  if (colSpan === 1 && rowSpan === 1) return false;

  const rows = contentArray(ctx.section);
  const firstEntries = contentArray(rows[ctx.rowIndex]);
  firstEntries[ctx.entryIndex] = ctx.entry.type.create(
    clearEntrySpan(ctx.entry),
    ctx.entry.content,
  );
  for (let i = 1; i < colSpan; i += 1) {
    firstEntries.splice(ctx.entryIndex + i, 0, createEmptyEntry(editor));
  }
  rows[ctx.rowIndex] = rows[ctx.rowIndex].type.create(
    rows[ctx.rowIndex].attrs,
    firstEntries,
  );

  for (let r = 1; r < rowSpan; r += 1) {
    const rowIndex = ctx.rowIndex + r;
    if (rowIndex >= rows.length) break;
    const entries = contentArray(rows[rowIndex]);
    for (let c = 0; c < colSpan; c += 1) {
      entries.splice(ctx.entryIndex + c, 0, createEmptyEntry(editor));
    }
    rows[rowIndex] = rows[rowIndex].type.create(rows[rowIndex].attrs, entries);
  }

  const tgroupChildren = mutateSectionRows(
    ctx.tgroup,
    ctx.sectionIndex,
    () => rows,
  );
  return replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, tgroupColumnCount(ctx.tgroup), tgroupChildren),
  );
}

function deleteTable(editor: Editor): boolean {
  const ctx = findTableContext(editor);
  if (!ctx) return false;
  const tr = editor.state.tr.delete(
    ctx.tablePos,
    ctx.tablePos + ctx.table.nodeSize,
  );
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** 切换表头：tbody 行 → thead 末尾；thead 行 → tbody 开头。 */
function toggleHeader(editor: Editor): boolean {
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;

  const tgroupChildren = contentArray(ctx.tgroup);

  if (ctx.section.type.name === "tbody") {
    const tbodyRows = contentArray(ctx.section);
    if (tbodyRows.length <= 1) return false;

    const rowToMove = tbodyRows[ctx.rowIndex];
    const nextTbodyRows = [...tbodyRows];
    nextTbodyRows.splice(ctx.rowIndex, 1);

    let theadIndex = -1;
    tgroupChildren.forEach((section, index) => {
      if (section.type.name === "thead") theadIndex = index;
    });

    if (theadIndex >= 0) {
      const thead = tgroupChildren[theadIndex];
      const theadRows = [...contentArray(thead), rowToMove];
      tgroupChildren[theadIndex] = thead.type.create(thead.attrs, theadRows);
    } else {
      const theadNode = editor.schema.nodes.thead.create(null, [rowToMove]);
      const firstTbodyIndex = tgroupChildren.findIndex(
        (section) => section.type.name === "tbody",
      );
      const insertAt =
        firstTbodyIndex >= 0 ? firstTbodyIndex : tgroupChildren.length;
      tgroupChildren.splice(insertAt, 0, theadNode);
    }

    tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(
      ctx.section.attrs,
      nextTbodyRows,
    );
  } else if (ctx.section.type.name === "thead") {
    const theadRows = contentArray(ctx.section);
    const rowToMove = theadRows[ctx.rowIndex];
    const nextTheadRows = [...theadRows];
    nextTheadRows.splice(ctx.rowIndex, 1);

    const tbodyIndex = tgroupChildren.findIndex(
      (section) => section.type.name === "tbody",
    );
    if (tbodyIndex < 0) return false;

    const tbody = tgroupChildren[tbodyIndex];
    const tbodyRows = [rowToMove, ...contentArray(tbody)];
    tgroupChildren[tbodyIndex] = tbody.type.create(tbody.attrs, tbodyRows);

    if (nextTheadRows.length === 0) {
      tgroupChildren.splice(ctx.sectionIndex, 1);
    } else {
      tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(
        ctx.section.attrs,
        nextTheadRows,
      );
    }
  } else {
    return false;
  }

  const moved = replaceTgroup(
    editor,
    ctx,
    updateTgroupCols(ctx.tgroup, tgroupColumnCount(ctx.tgroup), tgroupChildren),
  );
  if (moved) {
    clearTableCellSelection(editor);
  }
  return moved;
}

export function canRunS1000dTableAction(
  editor: Editor,
  action: TableAction,
): boolean {
  if (action === "deleteTable") return findTableContext(editor) != null;
  const ctx = resolvePrimaryCellContext(editor);
  if (!ctx) return false;
  if (action === "mergeCells") {
    const range = resolveCommandRange(editor);
    return range != null && !range.isSingleCell;
  }
  if (action === "splitCell") {
    return entryColSpan(ctx.entry) > 1 || entryRowSpan(ctx.entry) > 1;
  }
  if (action === "toggleHeader") {
    if (ctx.section.type.name === "tbody") {
      return contentArray(ctx.section).length > 1;
    }
    if (ctx.section.type.name === "thead") {
      return true;
    }
    return false;
  }
  return true;
}

export function runS1000dTableAction(
  editor: Editor,
  action: TableAction,
): boolean {
  switch (action) {
    case "insertRowAbove":
      return insertRow(editor, false);
    case "insertRowBelow":
      return insertRow(editor, true);
    case "deleteRow":
      return deleteRow(editor);
    case "toggleHeader":
      return toggleHeader(editor);
    case "insertColLeft":
      return insertColumn(editor, false);
    case "insertColRight":
      return insertColumn(editor, true);
    case "deleteCol":
      return deleteColumn(editor);
    case "mergeCells":
      return mergeCells(editor);
    case "splitCell":
      return splitCell(editor);
    case "deleteCell":
      return deleteCell(editor);
    case "clearCell":
      return clearCell(editor);
    case "deleteTable":
      return deleteTable(editor);
    default:
      return false;
  }
}
