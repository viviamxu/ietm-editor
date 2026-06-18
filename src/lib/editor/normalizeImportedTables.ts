import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { createMinimalS1000dTableInsertJson } from "../../extensions/s1000d/s1000dTableNodes";

const TRAILING_PARA_CONTAINER_TYPES = new Set([
  "proceduralStep",
  "levelledPara",
  "entry",
]);

function emptyParaJson(): JSONContent {
  return {
    type: "para",
    attrs: {
      textAlign: "left",
      sourceXmlAttrKeys: null,
      id: null,
      securityClassification: null,
      caveat: null,
      derivativeClassificationRefId: null,
      reasonForUpdateRefIds: null,
    },
    content: [],
  };
}

function normalizeImportedPara(para: JSONContent): JSONContent {
  return {
    ...para,
    attrs: {
      textAlign: para.attrs?.textAlign ?? "left",
      sourceXmlAttrKeys: null,
      id: para.attrs?.id ?? null,
      securityClassification: para.attrs?.securityClassification ?? null,
      caveat: para.attrs?.caveat ?? null,
      derivativeClassificationRefId:
        para.attrs?.derivativeClassificationRefId ?? null,
      reasonForUpdateRefIds: para.attrs?.reasonForUpdateRefIds ?? null,
    },
  };
}

function rowsInSection(section: JSONContent | undefined): JSONContent[] {
  if (!section?.content) return [];
  return section.content.filter((child) => child.type === "row");
}

function entryCountInRow(row: JSONContent): number {
  return (row.content ?? []).filter((child) => child.type === "entry").length;
}

function parasInEntry(entry: JSONContent | undefined): JSONContent[] {
  if (!entry) return [emptyParaJson()];
  const paras = (entry.content ?? []).filter((child) => child.type === "para");
  if (paras.length === 0) return [emptyParaJson()];
  return paras.map(normalizeImportedPara);
}

type ExtractedTableGrid = {
  cols: number;
  headerRowCount: number;
  bodyRows: number;
  includeTitle: boolean;
  tableTitleContent: JSONContent[] | undefined;
  tableAttrs: JSONContent["attrs"];
  cellParas: JSONContent[][][];
};

function extractTableGrid(table: JSONContent): ExtractedTableGrid {
  const tgroup = (table.content ?? []).find((child) => child.type === "tgroup");
  const titleNode = (table.content ?? []).find((child) => child.type === "title");
  const thead = (tgroup?.content ?? []).find((child) => child.type === "thead");
  const tbody = (tgroup?.content ?? []).find((child) => child.type === "tbody");

  const headerRows = rowsInSection(thead);
  const bodyRowsList = rowsInSection(tbody);
  const headerRowCount = headerRows.length;
  const bodyRows = Math.max(1, bodyRowsList.length);

  let cols = 1;
  for (const row of [...headerRows, ...bodyRowsList]) {
    cols = Math.max(cols, entryCountInRow(row));
  }
  const attrCols = Number.parseInt(String(tgroup?.attrs?.cols ?? ""), 10);
  if (!Number.isNaN(attrCols) && attrCols > 0) {
    cols = Math.max(cols, attrCols);
  }

  const cellParas: JSONContent[][][] = [];
  for (const row of [...headerRows, ...bodyRowsList]) {
    const entries = (row.content ?? []).filter((child) => child.type === "entry");
    const rowParas: JSONContent[][] = [];
    for (let col = 0; col < cols; col++) {
      rowParas.push(parasInEntry(entries[col]));
    }
    cellParas.push(rowParas);
  }

  if (cellParas.length === 0) {
    cellParas.push(Array.from({ length: cols }, () => [emptyParaJson()]));
  }

  return {
    cols,
    headerRowCount,
    bodyRows,
    includeTitle: titleNode != null,
    tableTitleContent: titleNode?.content,
    tableAttrs: table.attrs,
    cellParas,
  };
}

function normalizeToolbarTableSubtree(table: JSONContent): JSONContent {
  table.attrs = {
    sourceXmlAttrKeys: null,
    id: table.attrs?.id ?? null,
  };

  for (const child of table.content ?? []) {
    if (child.type === "title") {
      child.attrs = {
        sourceXmlAttrKeys: null,
        displayLevel: child.attrs?.displayLevel ?? 0,
        sectionNumber: child.attrs?.sectionNumber ?? null,
      };
      continue;
    }
    if (child.type !== "tgroup") continue;

    child.attrs = {
      sourceXmlAttrKeys: null,
      cols: child.attrs?.cols ?? "1",
      colsep: child.attrs?.colsep ?? null,
      rowsep: child.attrs?.rowsep ?? null,
    };

    for (const section of child.content ?? []) {
      section.attrs = { sourceXmlAttrKeys: null };
      for (const row of section.content ?? []) {
        if (row.type !== "row") continue;
        row.attrs = { sourceXmlAttrKeys: null };
        for (const entry of row.content ?? []) {
          if (entry.type !== "entry") continue;
          entry.attrs = {
            sourceXmlAttrKeys: null,
            colname: entry.attrs?.colname ?? null,
            namest: entry.attrs?.namest ?? null,
            nameend: entry.attrs?.nameend ?? null,
            morerows: entry.attrs?.morerows ?? null,
            align: entry.attrs?.align ?? null,
          };
          entry.content = (entry.content ?? [])
            .filter((node) => node.type === "para")
            .map(normalizeImportedPara);
          if (entry.content.length === 0) {
            entry.content = [emptyParaJson()];
          }
        }
      }
    }
  }

  return table;
}

function rebuildTableJson(table: JSONContent): JSONContent {
  const grid = extractTableGrid(table);
  const shell = createMinimalS1000dTableInsertJson(
    grid.cols,
    grid.headerRowCount,
    grid.bodyRows,
    grid.includeTitle,
  );

  if (grid.tableAttrs?.id != null && String(grid.tableAttrs.id).trim() !== "") {
    shell.attrs = {
      ...shell.attrs,
      id: grid.tableAttrs.id,
    };
  }

  let rowIndex = 0;
  const tgroup = shell.content?.find((child) => child.type === "tgroup");
  if (tgroup) {
    for (const section of tgroup.content ?? []) {
      for (const row of section.content ?? []) {
        if (row.type !== "row") continue;
        const sourceRow = grid.cellParas[rowIndex] ?? [];
        rowIndex += 1;
        const entries = row.content ?? [];
        for (let col = 0; col < entries.length; col++) {
          const entry = entries[col];
          if (entry?.type !== "entry") continue;
          entry.content = sourceRow[col] ?? [emptyParaJson()];
        }
      }
    }
  }

  const titleNode = shell.content?.find((child) => child.type === "title");
  if (titleNode && grid.tableTitleContent) {
    titleNode.content = grid.tableTitleContent;
  }

  return normalizeToolbarTableSubtree(shell);
}

function ensureTrailingParaAfterTableSiblings(
  content: JSONContent[],
): JSONContent[] {
  const out: JSONContent[] = [];
  for (let i = 0; i < content.length; i++) {
    const child = content[i];
    out.push(child);
    if (child.type !== "table") continue;
    const next = content[i + 1];
    if (next?.type === "para") continue;
    out.push(emptyParaJson());
  }
  return out;
}

function normalizeImportedTablesInJsonNode(node: JSONContent): JSONContent {
  if (node.type === "table") {
    return rebuildTableJson(node);
  }

  if (!node.content) return node;

  let content = node.content.map(normalizeImportedTablesInJsonNode);
  if (TRAILING_PARA_CONTAINER_TYPES.has(node.type ?? "")) {
    content = ensureTrailingParaAfterTableSiblings(content);
  }

  return { ...node, content };
}

export function docJsonHasTable(node: JSONContent): boolean {
  if (node.type === "table") return true;
  return (node.content ?? []).some(docJsonHasTable);
}

/** 将 XML/HTML 导入的 table 子树规范为与工具栏 JSON 插入同构（attrs、trailing para）。 */
export function normalizeImportedTablesJson(doc: JSONContent): JSONContent {
  if (doc.type !== "doc") return doc;
  return normalizeImportedTablesInJsonNode(doc);
}

function findFirstMainProcedureTextPos(doc: PMNode): number | null {
  let found: number | null = null;

  doc.descendants((node, pos) => {
    if (found != null) return false;
    if (node.type.name !== "para") return;

    const $pos = doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name !== "mainProcedure") continue;
      if (node.content.size === 0) return;
      found = pos + 1;
      return false;
    }
  });

  return found;
}

export function focusFirstMainProcedurePara(editor: Editor): boolean {
  const pos = findFirstMainProcedureTextPos(editor.state.doc);
  if (pos == null) return false;
  return editor.chain().focus().setTextSelection(pos).run();
}

/**
 * XML/HTML 载入后：重建 table JSON、补 table 后 trailing `para`、并将选区落到 `mainProcedure`。
 */
export function normalizeImportedTablesInEditor(
  editor: Editor,
  options?: { focusMainProcedure?: boolean },
): boolean {
  const json = editor.getJSON();
  if (!docJsonHasTable(json)) {
    if (options?.focusMainProcedure) {
      focusFirstMainProcedurePara(editor);
    }
    return false;
  }

  const normalized = normalizeImportedTablesJson(json);
  editor.commands.setContent(normalized);

  if (options?.focusMainProcedure !== false) {
    focusFirstMainProcedurePara(editor);
  }

  return true;
}
