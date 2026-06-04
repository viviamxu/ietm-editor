import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  InputNumber,
  Select,
  Table,
} from "@arco-design/web-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  applySupportEquipRowUpdate,
  deleteSupportEquipRow,
  insertSupportEquipRowAtEnd,
  readSupportEquipRowData,
  type SupportEquipRowData,
} from "../../lib/s1000d/supportEquipRow";
import {
  procedureTableRowDomProps,
  readPmNodeElementId,
} from "../../lib/s1000d/procedureTableRowDom";
import { useProcedureDictionaryStore } from "../../store/procedureDictionaryStore";
import { usePropertyPanelStore } from "../../store/propertyPanelStore";
import type { ProcedureDictionaryOption } from "../../types/procedureDictionaries";

const SUPPORT_EQUIP_COLUMNS = [
  "名称",
  "物料号",
  "数量",
  "备注",
  "操作",
] as const;

/** 仅当 code 在 `timeUnit` 字典中存在时才作为 Select value，否则 undefined。 */
function dictionarySelectValue(
  code: string,
  options: ProcedureDictionaryOption[],
): string | undefined {
  const trimmed = code.trim();
  if (!trimmed || !options.some((o) => o.code === trimmed)) return undefined;
  return trimmed;
}
type EquipRowNodeType = "supportEquipDescr" | "supplyDescr" | "spareDescr";
type EquipGroupNodeType =
  | "supportEquipDescrGroup"
  | "supplyDescrGroup"
  | "spareDescrGroup";
type EquipTableRow = {
  key: string;
  rowIndex: number;
  pos: number;
  elementId: string | null;
  data: SupportEquipRowData;
};

function useEditorRefresh(editor: NodeViewProps["editor"]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const on = () => bump();
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
}

function stopEditorPropagation(e: ReactMouseEvent) {
  e.stopPropagation();
}

function stopEditorPointer(e: ReactMouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function stopEditorKeydown(e: ReactKeyboardEvent) {
  e.stopPropagation();
}

function stopTableEditorMouseDown(e: ReactMouseEvent) {
  e.preventDefault();
}

function resolveRowPosInParent(
  parentPos: number,
  parentNode: NodeViewProps["node"],
  rowIndex: number,
  rowNodeType: EquipRowNodeType,
): number | null {
  let index = 0;
  let found: number | null = null;
  parentNode.forEach((child, offset) => {
    if (child.type.name !== rowNodeType) return;
    if (index === rowIndex) found = parentPos + 1 + offset;
    index++;
  });
  return found;
}

function buildEquipTableRows(
  parentNode: NodeViewProps["node"],
  basePos: number,
  groupNodeType: EquipGroupNodeType,
  rowNodeType: EquipRowNodeType,
): EquipTableRow[] {
  const list: EquipTableRow[] = [];
  let rowIndex = 0;
  parentNode.forEach((child, offset) => {
    if (child.type.name !== rowNodeType) return;
    list.push({
      key: `${groupNodeType}-${rowIndex}`,
      rowIndex,
      pos: basePos + 1 + offset,
      elementId: readPmNodeElementId(child),
      data: readSupportEquipRowData(child),
    });
    rowIndex++;
  });
  return list;
}

export function SupportEquipDescrGroupNodeView(props: NodeViewProps) {
  return (
    <EquipDescrGroupNodeView
      props={props}
      groupNodeType="supportEquipDescrGroup"
      rowNodeType="supportEquipDescr"
      addText="添加工装工具"
      deleteRowLabel="删除工装工具行"
    />
  );
}

export function SupplyDescrGroupNodeView(props: NodeViewProps) {
  return (
    <EquipDescrGroupNodeView
      props={props}
      groupNodeType="supplyDescrGroup"
      rowNodeType="supplyDescr"
      addText="添加辅料"
      deleteRowLabel="删除辅料行"
    />
  );
}

export function SpareDescrGroupNodeView(props: NodeViewProps) {
  return (
    <EquipDescrGroupNodeView
      props={props}
      groupNodeType="spareDescrGroup"
      rowNodeType="spareDescr"
      addText="添加备件"
      deleteRowLabel="删除备品行"
    />
  );
}

function EquipDescrGroupNodeView({
  props,
  groupNodeType,
  rowNodeType,
  addText,
  deleteRowLabel,
}: {
  props: NodeViewProps;
  groupNodeType: EquipGroupNodeType;
  rowNodeType: EquipRowNodeType;
  addText: string;
  deleteRowLabel: string;
}) {
  const { editor, getPos } = props;
  const unitOptions = useProcedureDictionaryStore((s) => s.dictionaries.timeUnit);
  useEditorRefresh(editor);

  const rows = useMemo<EquipTableRow[]>(() => {
    const basePos = getPos?.();
    if (basePos == null) return [];
    return buildEquipTableRows(props.node, basePos, groupNodeType, rowNodeType);
  }, [getPos, groupNodeType, props.node, rowNodeType]);

  const resolveRowPos = useCallback(
    (rowIndex: number) => {
      const basePos = getPos?.();
      if (basePos == null) return null;
      const parent = editor.state.doc.nodeAt(basePos);
      if (!parent || parent.type.name !== groupNodeType) return null;
      return resolveRowPosInParent(basePos, parent, rowIndex, rowNodeType);
    },
    [editor, getPos, groupNodeType, rowNodeType],
  );

  const addRow = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      const pos = getPos?.();
      if (pos == null) return;
      insertSupportEquipRowAtEnd(editor, pos, groupNodeType, rowNodeType);
      editor.commands.focus();
    },
    [editor, getPos, groupNodeType, rowNodeType],
  );

  const commitRow = useCallback(
    (rowIndex: number, patch: Partial<SupportEquipRowData>) => {
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      const current = editor.state.doc.nodeAt(rowPos);
      if (!current || current.type.name !== rowNodeType) return;
      const row = readSupportEquipRowData(current);
      applySupportEquipRowUpdate(
        editor,
        rowPos,
        { ...row, ...patch },
        rowNodeType,
      );
    },
    [editor, resolveRowPos, rowNodeType],
  );

  const deleteRow = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, rowIndex: number) => {
      e.preventDefault();
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      deleteSupportEquipRow(editor, rowPos, rowNodeType);
    },
    [editor, resolveRowPos, rowNodeType],
  );

  const openRowProperties = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, rowIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      const node = editor.state.doc.nodeAt(rowPos);
      if (!node || node.type.name !== rowNodeType) return;
      editor.chain().focus().setNodeSelection(rowPos).run();
      usePropertyPanelStore.getState().pinInspect({
        nodeType: rowNodeType,
        pos: rowPos,
        attrs: { ...node.attrs },
      });
      usePropertyPanelStore.getState().requestOpenPropertyPanel();
    },
    [editor, resolveRowPos, rowNodeType],
  );

  const columns = useMemo(
    () => [
      {
        title: SUPPORT_EQUIP_COLUMNS[0],
        width: "24%",
        render: (_: unknown, row: EquipTableRow) => (
          <Input
            value={row.data.name}
            placeholder="名称"
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) => commitRow(row.rowIndex, { name: value })}
          />
        ),
      },
      {
        title: SUPPORT_EQUIP_COLUMNS[1],
        width: "24%",
        render: (_: unknown, row: EquipTableRow) => (
          <Input
            value={row.data.natoStockNumber}
            placeholder="物料号"
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) =>
              commitRow(row.rowIndex, { natoStockNumber: value })
            }
          />
        ),
      },
      {
        title: SUPPORT_EQUIP_COLUMNS[2],
        width: "24%",
        render: (_: unknown, row: EquipTableRow) => {
          const unitValue = dictionarySelectValue(
            row.data.unitOfMeasure,
            unitOptions,
          );
          return (
            <div className="s1000d-support-equip__qty-cell">
              <InputNumber
                min={0}
                value={
                  row.data.reqQuantity.trim() === ""
                    ? undefined
                    : Number(row.data.reqQuantity)
                }
                onMouseDown={stopEditorPropagation}
                onChange={(value) =>
                  commitRow(row.rowIndex, {
                    reqQuantity: value == null ? "" : String(value),
                  })
                }
              />
              <div onMouseDown={stopEditorPointer}>
                <Select
                  placeholder="单位"
                  allowClear
                  value={unitValue}
                  onChange={(value) =>
                    commitRow(row.rowIndex, {
                      unitOfMeasure: String(value ?? ""),
                    })
                  }
                >
                  {unitOptions.map((opt) => (
                    <Select.Option key={opt.code} value={opt.code}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          );
        },
      },
      {
        title: SUPPORT_EQUIP_COLUMNS[3],
        render: (_: unknown, row: EquipTableRow) => (
          <Input
            value={row.data.remarks}
            placeholder="备注"
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) => commitRow(row.rowIndex, { remarks: value })}
          />
        ),
      },
      {
        title: SUPPORT_EQUIP_COLUMNS[4],
        width: 88,
        align: "center" as const,
        render: (_: unknown, row: EquipTableRow) => (
          <div className="s1000d-support-equip__row-actions">
            <button
              type="button"
              className="s1000d-support-equip__props-btn"
              contentEditable={false}
              title="属性"
              aria-label={`${addText}行属性`}
              onMouseDown={stopEditorPointer}
              onClick={(e) => openRowProperties(e, row.rowIndex)}
            >
              <Settings2 size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="s1000d-support-equip__delete-btn"
              contentEditable={false}
              title="删除"
              aria-label={deleteRowLabel}
              onMouseDown={stopEditorPointer}
              onClick={(e) => deleteRow(e, row.rowIndex)}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ),
      },
    ],
    [addText, commitRow, deleteRow, deleteRowLabel, openRowProperties, unitOptions],
  );

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-support-equip"
      data-s1000d-node={groupNodeType}
      onMouseDown={stopTableEditorMouseDown}
    >
      <Table
        className="s1000d-support-equip__table"
        columns={columns}
        data={rows}
        rowKey="key"
        pagination={false}
        borderCell
        onRow={(record) => procedureTableRowDomProps(record)}
      />
      <div className="s1000d-support-equip__toolbar" contentEditable={false}>
        <Button
          type="text"
          size="small"
          className="s1000d-support-equip__add-btn"
          icon={<Plus size={14} aria-hidden />}
          onMouseDown={(e) => e.preventDefault()}
          onClick={addRow}
        >
          {addText}
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

function HiddenDescrRowNodeView(props: NodeViewProps) {
  const elementId = readPmNodeElementId(props.node);
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-descr-row-host"
      contentEditable={false}
      data-s1000d-node={props.node.type.name}
      {...(elementId
        ? { id: elementId, "data-s1000d-element-id": elementId }
        : {})}
    >
      <NodeViewContent className="s1000d-descr-row-host__content" />
    </NodeViewWrapper>
  );
}

export function SupportEquipDescrNodeView(props: NodeViewProps) {
  return <HiddenDescrRowNodeView {...props} />;
}

export function SupplyDescrNodeView(props: NodeViewProps) {
  return <HiddenDescrRowNodeView {...props} />;
}

export function SpareDescrNodeView(props: NodeViewProps) {
  return <HiddenDescrRowNodeView {...props} />;
}
