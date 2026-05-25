import type { Editor, JSONContent } from "@tiptap/core";

import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";

function isAlreadyS1000dTable(table: HTMLTableElement): boolean {
  if (table.classList.contains("s1000d-tgroup-table")) return true;
  if (table.closest('[data-s1000d-xml-table="1"], .s1000d-table-wrap')) {
    return true;
  }
  return false;
}

function collectTableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = [];
  for (const section of table.querySelectorAll("thead, tbody, tfoot")) {
    rows.push(...Array.from(section.querySelectorAll(":scope > tr")));
  }
  if (rows.length === 0) {
    rows.push(...Array.from(table.querySelectorAll(":scope > tr")));
  }
  return rows;
}

function tableToTextGrid(table: HTMLTableElement): string[][] {
  return collectTableRows(table).map((row) =>
    Array.from(row.cells).map(
      (cell) => cell.textContent?.replace(/\u00a0/g, " ").trim() ?? "",
    ),
  );
}

/** 解析 Word 常见的 Tab 分隔纯文本（TSV）。 */
export function parseTsvGrid(plain: string): string[][] | null {
  const normalized = plain.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const hasTab = lines.some((line) => line.includes("\t"));
  if (!hasTab && lines.length < 2) return null;

  const rows = lines.map((line) => line.split("\t"));
  const colCount = Math.max(1, ...rows.map((row) => row.length));

  if (!hasTab && colCount < 2) return null;

  return rows.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) cells.push("");
    return cells.map((cell) => cell.replace(/\u00a0/g, " ").trim());
  });
}

function extractLargestGridFromWordHtml(html: string): string[][] | null {
  if (!html || !/<table\b/i.test(html)) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.body.querySelectorAll("table")).filter(
    (table) => !isAlreadyS1000dTable(table) && !table.parentElement?.closest("table"),
  );

  let best: string[][] | null = null;
  let bestScore = 0;

  for (const table of tables) {
    const grid = tableToTextGrid(table);
    const cols = Math.max(1, ...grid.map((row) => row.length), 1);
    const score = grid.length * cols;
    if (score > bestScore) {
      bestScore = score;
      best = grid;
    }
  }

  return best;
}

function shouldHandleWordTablePaste(html: string, plain: string): boolean {
  const tsv = parseTsvGrid(plain);
  if (tsv) {
    const cols = Math.max(1, ...tsv.map((row) => row.length), 1);
    if (tsv.length > 1 || cols > 1) return true;
  }
  return /<table\b/i.test(html);
}

/** 按行列文本生成一张完整 S1000D `table` JSON。 */
export function buildTableJsonFromGrid(grid: string[][]): JSONContent {
  const rowCount = Math.max(1, grid.length);
  const colCount = Math.max(1, ...grid.map((row) => row.length), 1);

  const normalized = grid.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) cells.push("");
    return cells.map((cell) => cell.replace(/\u00a0/g, " ").trim());
  });

  const table = createMinimalS1000dTableInsertJson(colCount, 0, rowCount);
  const tgroup = table.content?.find((node) => node.type === "tgroup");
  const tbody = tgroup?.content?.find((node) => node.type === "tbody");

  if (tbody?.content) {
    for (let rowIndex = 0; rowIndex < normalized.length; rowIndex++) {
      const rowNode = tbody.content[rowIndex];
      if (rowNode?.type !== "row" || !rowNode.content) continue;

      for (let colIndex = 0; colIndex < colCount; colIndex++) {
        const text = normalized[rowIndex][colIndex] ?? "";
        const entry = rowNode.content[colIndex];
        if (entry?.type !== "entry") continue;

        entry.content = [
          {
            type: "para",
            attrs: { textAlign: "left" },
            content: text ? [{ type: "text", text }] : [],
          },
        ];
      }
    }
  }

  return table;
}

/**
 * 从剪贴板合成一张表：优先 Word 的 TSV 纯文本（避免 HTML 碎表），否则取 HTML 中最大表格。
 */
export function buildMergedTableJsonFromClipboard(
  html: string,
  plain: string,
): JSONContent | null {
  const tsvGrid = parseTsvGrid(plain);
  const htmlGrid = extractLargestGridFromWordHtml(html);

  const tsvCells = tsvGrid
    ? tsvGrid.length * Math.max(1, ...tsvGrid.map((row) => row.length), 1)
    : 0;
  const htmlCells = htmlGrid
    ? htmlGrid.length * Math.max(1, ...htmlGrid.map((row) => row.length), 1)
    : 0;

  if (tsvGrid && tsvCells >= 2 && (htmlCells <= 1 || tsvCells >= htmlCells)) {
    return buildTableJsonFromGrid(tsvGrid);
  }
  if (htmlGrid && htmlCells >= 1) {
    return buildTableJsonFromGrid(htmlGrid);
  }
  if (tsvGrid && tsvCells >= 1) {
    return buildTableJsonFromGrid(tsvGrid);
  }
  return null;
}

/**
 * `handlePaste`：阻止默认粘贴，只插入一张合并后的 S1000D 表。
 */
export function handleWordTablePaste(
  editor: Editor,
  event: ClipboardEvent,
): boolean {
  if (!editor.isEditable) return false;

  const html = event.clipboardData?.getData("text/html") ?? "";
  const plain = event.clipboardData?.getData("text/plain") ?? "";

  if (!shouldHandleWordTablePaste(html, plain)) return false;

  const tableJson = buildMergedTableJsonFromClipboard(html, plain);
  if (!tableJson) return false;

  return editor.chain().focus().insertContent(tableJson).run();
}
