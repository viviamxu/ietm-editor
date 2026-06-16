import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  InputNumber,
  Select,
  Table,
} from "@arco-design/web-react";
import {
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useNodeViewEditorState } from "../../hooks/useNodeViewEditorState";
import {
  applyCatalogSeqNumberRowUpdate,
  collectHotspotOptions,
  deleteCatalogSeqNumberRow,
  insertCatalogSeqNumberRowAtEnd,
  readCatalogSeqNumberRowData,
  type CatalogSeqNumberRowData,
} from "../../lib/s1000d/catalogSeqNumberRow";
import { procedureTableRowDomProps } from "../../lib/s1000d/procedureTableRowDom";

const CATALOG_COLUMNS = [
  "物料名称",
  "热点ID",
  "每件数量",
  "总数量",
  "物料号",
  "备注",
  "操作",
] as const;

type CatalogTableRow = {
  key: string;
  rowIndex: number;
  pos: number;
  data: CatalogSeqNumberRowData;
};

function stopEditorPropagation(e: ReactMouseEvent) {
  e.stopPropagation();
}

function stopEditorKeydown(e: ReactKeyboardEvent) {
  e.stopPropagation();
}

function stopTableEditorMouseDown(e: ReactMouseEvent) {
  e.preventDefault();
}

function resolveRowPosInGroup(
  groupPos: number,
  groupNode: NodeViewProps["node"],
  rowIndex: number,
): number | null {
  let index = 0;
  let found: number | null = null;
  groupNode.forEach((child, offset) => {
    if (child.type.name !== "catalogSeqNumber") return;
    if (index === rowIndex) found = groupPos + 1 + offset;
    index++;
  });
  return found;
}

function buildCatalogTableRows(
  groupNode: NodeViewProps["node"],
  basePos: number,
): CatalogTableRow[] {
  const list: CatalogTableRow[] = [];
  let rowIndex = 0;
  groupNode.forEach((child, offset) => {
    if (child.type.name !== "catalogSeqNumber") return;
    list.push({
      key: `catalogSeqNumber-${rowIndex}`,
      rowIndex,
      pos: basePos + 1 + offset,
      data: readCatalogSeqNumberRowData(child),
    });
    rowIndex++;
  });
  return list;
}

export function CatalogSeqNumberGroupNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  const { readOnly } = useNodeViewEditorState(editor);

  const hotspotOptions = useMemo(
    () => collectHotspotOptions(editor.state.doc),
    [editor.state.doc],
  );

  const rows = useMemo<CatalogTableRow[]>(() => {
    const basePos = getPos?.();
    if (basePos == null) return [];
    return buildCatalogTableRows(props.node, basePos);
  }, [getPos, props.node]);

  const resolveRowPos = useCallback(
    (rowIndex: number) => {
      const basePos = getPos?.();
      if (basePos == null) return null;
      const parent = editor.state.doc.nodeAt(basePos);
      if (!parent || parent.type.name !== "catalogSeqNumberGroup") return null;
      return resolveRowPosInGroup(basePos, parent, rowIndex);
    },
    [editor, getPos],
  );

  const commitRow = useCallback(
    (rowIndex: number, patch: Partial<CatalogSeqNumberRowData>) => {
      if (!editor.isEditable) return;
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      const current = editor.state.doc.nodeAt(rowPos);
      if (!current || current.type.name !== "catalogSeqNumber") return;
      const row = readCatalogSeqNumberRowData(current);
      applyCatalogSeqNumberRowUpdate(editor, rowPos, { ...row, ...patch });
    },
    [editor, resolveRowPos],
  );

  const addRow = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!editor.isEditable) return;
      const pos = getPos?.();
      if (pos == null) return;
      insertCatalogSeqNumberRowAtEnd(editor, pos);
      editor.commands.focus();
    },
    [editor, getPos],
  );

  const deleteRow = useCallback(
    (e: { preventDefault?: () => void }, rowIndex: number) => {
      e.preventDefault?.();
      if (!editor.isEditable) return;
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      deleteCatalogSeqNumberRow(editor, rowPos);
    },
    [editor, resolveRowPos],
  );

  const columns = useMemo(
    () => [
      {
        title: CATALOG_COLUMNS[0],
        width: "18%",
        render: (_: unknown, row: CatalogTableRow) => (
          <Input
            value={row.data.descrForPart}
            placeholder="物料名称"
            disabled={readOnly}
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) =>
              commitRow(row.rowIndex, { descrForPart: value })
            }
          />
        ),
      },
      {
        title: CATALOG_COLUMNS[1],
        width: "16%",
        render: (_: unknown, row: CatalogTableRow) => (
          <div onMouseDown={stopEditorPropagation}>
            <Select
              placeholder="点击选择"
              allowClear
              disabled={readOnly}
              value={row.data.hotspotRefId || undefined}
              onChange={(value) =>
                commitRow(row.rowIndex, {
                  hotspotRefId: value == null ? "" : String(value),
                })
              }
            >
              {hotspotOptions.map((opt) => (
                <Select.Option key={opt.id} value={opt.id}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </div>
        ),
      },
      {
        title: CATALOG_COLUMNS[2],
        width: "10%",
        render: (_: unknown, row: CatalogTableRow) => (
          <InputNumber
            min={0}
            disabled={readOnly}
            value={
              row.data.quantityPerNextHigherAssy.trim() === ""
                ? undefined
                : Number(row.data.quantityPerNextHigherAssy)
            }
            onMouseDown={stopEditorPropagation}
            onChange={(value) =>
              commitRow(row.rowIndex, {
                quantityPerNextHigherAssy:
                  value == null ? "" : String(value),
              })
            }
          />
        ),
      },
      {
        title: CATALOG_COLUMNS[3],
        width: "10%",
        render: (_: unknown, row: CatalogTableRow) => (
          <InputNumber
            min={0}
            disabled={readOnly}
            value={
              row.data.totalQuantity.trim() === ""
                ? undefined
                : Number(row.data.totalQuantity)
            }
            onMouseDown={stopEditorPropagation}
            onChange={(value) =>
              commitRow(row.rowIndex, {
                totalQuantity: value == null ? "" : String(value),
              })
            }
          />
        ),
      },
      {
        title: CATALOG_COLUMNS[4],
        width: "16%",
        render: (_: unknown, row: CatalogTableRow) => (
          <Input
            value={row.data.overLengthPartNumber}
            placeholder="物料号"
            disabled={readOnly}
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) =>
              commitRow(row.rowIndex, { overLengthPartNumber: value })
            }
          />
        ),
      },
      {
        title: CATALOG_COLUMNS[5],
        width: "14%",
        render: (_: unknown, row: CatalogTableRow) => (
          <Input
            value={row.data.partKeyword}
            placeholder="备注"
            disabled={readOnly}
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) => commitRow(row.rowIndex, { partKeyword: value })}
          />
        ),
      },
      {
        title: CATALOG_COLUMNS[6],
        width: "8%",
        render: (_: unknown, row: CatalogTableRow) =>
          readOnly ? null : (
            <Button
              type="text"
              status="danger"
              icon={<Trash2 size={14} aria-hidden />}
              aria-label="删除物料行"
              onMouseDown={stopEditorPropagation}
              onClick={(e) => deleteRow(e, row.rowIndex)}
            />
          ),
      },
    ],
    [commitRow, deleteRow, hotspotOptions, readOnly],
  );

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-catalog-seq-group"
      data-s1000d-node="catalogSeqNumberGroup"
      onMouseDown={stopTableEditorMouseDown}
    >
      <Table
        className="s1000d-catalog-seq-group__table"
        columns={columns}
        data={rows}
        rowKey="key"
        pagination={false}
        borderCell
        onRow={(record) => procedureTableRowDomProps(record)}
      />
      {!readOnly ? (
        <div className="s1000d-catalog-seq-group__toolbar" contentEditable={false}>
          <Button
            type="text"
            size="small"
            className="s1000d-catalog-seq-group__add-btn"
            icon={<Plus size={14} aria-hidden />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={addRow}
          >
            添加物料行
          </Button>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
