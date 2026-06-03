import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
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
  useEffect,
  useMemo,
  useReducer,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useProcedureSectionHeading } from "../../hooks/useProcedureSectionHeading";
import {
  applyPersonnelRowUpdate,
  deletePersonnelRow,
  insertPersonnelRowAtEnd,
  readPersonnelRowData,
  type PersonnelRowData,
} from "../../lib/s1000d/personnelRow";
import { useProcedureDictionaryStore } from "../../store/procedureDictionaryStore";
import type { ProcedureDictionaryOption } from "../../types/procedureDictionaries";

const PERSONNEL_COLUMNS = [
  "类型",
  "技能与等级",
  "行业",
  "工时",
  "数量",
  "操作",
] as const;

type PersonnelTableRow = {
  key: string;
  rowIndex: number;
  data: PersonnelRowData;
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
  parentNode: PMNode,
  rowIndex: number,
): number | null {
  let index = 0;
  let found: number | null = null;
  parentNode.forEach((child, offset) => {
    if (child.type.name !== "personnel") return;
    if (index === rowIndex) found = parentPos + 1 + offset;
    index++;
  });
  return found;
}

function buildPersonnelTableRows(parentNode: PMNode): PersonnelTableRow[] {
  const list: PersonnelTableRow[] = [];
  let rowIndex = 0;
  parentNode.forEach((child) => {
    if (child.type.name !== "personnel") return;
    list.push({
      key: `reqPersons-${rowIndex}`,
      rowIndex,
      data: readPersonnelRowData(child),
    });
    rowIndex++;
  });
  return list;
}

function dictionarySelectOptions(
  options: ProcedureDictionaryOption[],
  current: string,
) {
  const orphan =
    current && !options.some((o) => o.code === current)
      ? [{ code: current, label: current }]
      : [];
  return [...orphan, ...options];
}

export function ReqPersonsNodeView(props: NodeViewProps) {
  const { editor, getPos } = props;
  const { full: sectionLabel } = useProcedureSectionHeading(props);
  const dictionaries = useProcedureDictionaryStore((s) => s.dictionaries);
  useEditorRefresh(editor);

  const rows = useMemo<PersonnelTableRow[]>(() => {
    const basePos = getPos?.();
    if (basePos == null) return [];
    return buildPersonnelTableRows(props.node);
  }, [getPos, props.node]);

  const resolveRowPos = useCallback(
    (rowIndex: number) => {
      const basePos = getPos?.();
      if (basePos == null) return null;
      const parent = editor.state.doc.nodeAt(basePos);
      if (!parent || parent.type.name !== "reqPersons") return null;
      return resolveRowPosInParent(basePos, parent, rowIndex);
    },
    [editor, getPos],
  );

  const addRow = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      const pos = getPos?.();
      if (pos == null) return;
      insertPersonnelRowAtEnd(editor, pos);
      editor.commands.focus();
    },
    [editor, getPos],
  );

  const commitRow = useCallback(
    (rowIndex: number, patch: Partial<PersonnelRowData>) => {
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      const current = editor.state.doc.nodeAt(rowPos);
      if (!current || current.type.name !== "personnel") return;
      const row = readPersonnelRowData(current);
      applyPersonnelRowUpdate(editor, rowPos, { ...row, ...patch });
    },
    [editor, resolveRowPos],
  );

  const deleteRow = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, rowIndex: number) => {
      e.preventDefault();
      const rowPos = resolveRowPos(rowIndex);
      if (rowPos == null) return;
      deletePersonnelRow(editor, rowPos);
    },
    [editor, resolveRowPos],
  );

  const categoryOptions = dictionaries.personCategory;
  const skillOptions = dictionaries.personSkill;
  const unitOptions = dictionaries.timeUnit;

  const columns = useMemo(
    () => [
      {
        title: PERSONNEL_COLUMNS[0],
        width: "16%",
        render: (_: unknown, row: PersonnelTableRow) => {
          const value =
            row.data.personCategoryCode || categoryOptions[0]?.code || "";
          return (
            <div onMouseDown={stopEditorPointer}>
              <Select
                value={value}
                onChange={(v) =>
                  commitRow(row.rowIndex, {
                    personCategoryCode: String(v ?? ""),
                  })
                }
              >
                {dictionarySelectOptions(categoryOptions, value).map((opt) => (
                  <Select.Option key={opt.code} value={opt.code}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          );
        },
      },
      {
        title: PERSONNEL_COLUMNS[1],
        width: "16%",
        render: (_: unknown, row: PersonnelTableRow) => {
          const value = row.data.skillLevelCode || skillOptions[0]?.code || "";
          return (
            <div onMouseDown={stopEditorPointer}>
              <Select
                value={value}
                onChange={(v) =>
                  commitRow(row.rowIndex, { skillLevelCode: String(v ?? "") })
                }
              >
                {dictionarySelectOptions(skillOptions, value).map((opt) => (
                  <Select.Option key={opt.code} value={opt.code}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          );
        },
      },
      {
        title: PERSONNEL_COLUMNS[2],
        render: (_: unknown, row: PersonnelTableRow) => (
          <Input
            value={row.data.trade}
            placeholder="行业"
            onMouseDown={stopEditorPropagation}
            onKeyDown={stopEditorKeydown}
            onChange={(value) => commitRow(row.rowIndex, { trade: value })}
          />
        ),
      },
      {
        title: PERSONNEL_COLUMNS[3],
        width: "22%",
        render: (_: unknown, row: PersonnelTableRow) => {
          const unitValue =
            row.data.unitOfMeasure || unitOptions[0]?.code || "h";
          return (
            <div className="s1000d-support-equip__qty-cell">
              <Input
                value={row.data.estimatedTime}
                placeholder="0"
                onMouseDown={stopEditorPropagation}
                onKeyDown={stopEditorKeydown}
                onChange={(value) =>
                  commitRow(row.rowIndex, { estimatedTime: value })
                }
              />
              <div onMouseDown={stopEditorPointer}>
                <Select
                  value={unitValue}
                  onChange={(v) =>
                    commitRow(row.rowIndex, {
                      unitOfMeasure: String(v ?? unitOptions[0]?.code ?? "h"),
                    })
                  }
                >
                  {dictionarySelectOptions(unitOptions, unitValue).map(
                    (opt) => (
                      <Select.Option key={opt.code} value={opt.code}>
                        {opt.label}
                      </Select.Option>
                    ),
                  )}
                </Select>
              </div>
            </div>
          );
        },
      },
      {
        title: PERSONNEL_COLUMNS[4],
        width: "10%",
        render: (_: unknown, row: PersonnelTableRow) => (
          <InputNumber
            min={0}
            value={
              row.data.numRequired.trim() === ""
                ? undefined
                : Number(row.data.numRequired)
            }
            onMouseDown={stopEditorPropagation}
            onChange={(value) =>
              commitRow(row.rowIndex, {
                numRequired: value == null ? "" : String(value),
              })
            }
          />
        ),
      },
      {
        title: PERSONNEL_COLUMNS[5],
        width: 64,
        align: "center" as const,
        render: (_: unknown, row: PersonnelTableRow) => (
          <button
            type="button"
            className="s1000d-support-equip__delete-btn"
            contentEditable={false}
            title="删除"
            aria-label="删除人员行"
            onMouseDown={stopEditorPointer}
            onClick={(e) => deleteRow(e, row.rowIndex)}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        ),
      },
    ],
    [categoryOptions, commitRow, deleteRow, skillOptions, unitOptions],
  );

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-req-persons"
      data-s1000d-node="reqPersons"
      onMouseDown={stopTableEditorMouseDown}
    >
      {sectionLabel ? (
        <div className="s1000d-req-persons__label" contentEditable={false}>
          {sectionLabel}
        </div>
      ) : null}
      <Table
        className="s1000d-support-equip__table"
        columns={columns}
        data={rows}
        rowKey="key"
        pagination={false}
        borderCell
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
          添加人员
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

function HiddenPersonnelRowNodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-descr-row-host"
      contentEditable={false}
      data-s1000d-node={props.node.type.name}
    >
      <NodeViewContent className="s1000d-descr-row-host__content" />
    </NodeViewWrapper>
  );
}

export function PersonnelNodeView(props: NodeViewProps) {
  return <HiddenPersonnelRowNodeView {...props} />;
}
