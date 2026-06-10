import type { Editor } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";

import { getProcedureDictionaries } from "../../store/procedureDictionaryStore";

export type SupportEquipRowData = {
  name: string;
  natoStockNumber: string;
  reqQuantity: string;
  unitOfMeasure: string;
  remarks: string;
};

function firstTimeUnitCode(): string {
  return getProcedureDictionaries().timeUnit[0]?.code ?? "";
}
type EquipRowNodeType = "supportEquipDescr" | "supplyDescr" | "spareDescr";
type EquipGroupNodeType =
  | "supportEquipDescrGroup"
  | "supplyDescrGroup"
  | "spareDescrGroup";

const REQ_EQUIP_DESCR_CONFIG = {
  reqSupportEquips: {
    noType: "noSupportEquips",
    groupType: "supportEquipDescrGroup",
    rowType: "supportEquipDescr",
  },
  reqSupplies: {
    noType: "noSupplies",
    groupType: "supplyDescrGroup",
    rowType: "supplyDescr",
  },
  reqSpares: {
    noType: "noSpares",
    groupType: "spareDescrGroup",
    rowType: "spareDescr",
  },
} as const satisfies Record<
  string,
  { noType: string; groupType: EquipGroupNodeType; rowType: EquipRowNodeType }
>;

export type EquipReqContainerType = keyof typeof REQ_EQUIP_DESCR_CONFIG;

function findChild(node: PMNode, typeName: string): PMNode | null {
  let found: PMNode | null = null;
  node.forEach((child) => {
    if (child.type.name === typeName) found = child;
  });
  return found;
}

function inlineTextNode(
  schema: Schema,
  typeName: string,
  text: string,
  attrs?: Record<string, string | null>,
): PMNode {
  const type = schema.nodes[typeName];
  if (!type) throw new Error(`Missing schema node: ${typeName}`);
  const content = text ? schema.text(text) : undefined;
  return type.create(attrs ?? {}, content);
}

function readRemarksText(remarks: PMNode | null): string {
  if (!remarks) return "";
  const simplePara = findChild(remarks, "simplePara");
  if (simplePara) return simplePara.textContent ?? "";
  return remarks.textContent ?? "";
}

function remarksNode(schema: Schema, text: string): PMNode {
  const remarksType = schema.nodes.remarks;
  const simpleParaType = schema.nodes.simplePara;
  if (!remarksType || !simpleParaType) {
    throw new Error("Support equipment schema nodes are not registered");
  }
  const simplePara = inlineTextNode(schema, "simplePara", text);
  return remarksType.create({}, simplePara);
}

/** 新建工装/辅料/备品行时的默认值（数量单位取 `timeUnit` 首项；字典为空则留空）。 */
export function defaultSupportEquipRowData(): SupportEquipRowData {
  return {
    name: "",
    natoStockNumber: "",
    reqQuantity: "",
    unitOfMeasure: firstTimeUnitCode(),
    remarks: "",
  };
}

export function readSupportEquipRowData(node: PMNode): SupportEquipRowData {
  const name = findChild(node, "name");
  const natoStockNumber = findChild(node, "natoStockNumber");
  const reqQuantity = findChild(node, "reqQuantity");
  const remarks = findChild(node, "remarks");

  return {
    name: name?.textContent ?? "",
    natoStockNumber: natoStockNumber?.textContent ?? "",
    reqQuantity: reqQuantity?.textContent ?? "",
    unitOfMeasure: String(reqQuantity?.attrs.unitOfMeasure ?? "").trim(),
    remarks: readRemarksText(remarks),
  };
}

export function buildSupportEquipRowNode(
  schema: Schema,
  data: SupportEquipRowData,
  rowNodeType: EquipRowNodeType = "supportEquipDescr",
  identNumberNode?: PMNode | null,
): PMNode {
  const rowNodeSchema = schema.nodes[rowNodeType];
  if (!rowNodeSchema) {
    throw new Error("Support equipment schema nodes are not registered");
  }

  const children: PMNode[] = [
    inlineTextNode(schema, "name", data.name),
    inlineTextNode(schema, "natoStockNumber", data.natoStockNumber),
  ];
  if (identNumberNode) children.push(identNumberNode);
  const unit = data.unitOfMeasure.trim();
  if (data.reqQuantity.trim() || unit) {
    children.push(
      inlineTextNode(schema, "reqQuantity", data.reqQuantity, {
        unitOfMeasure: unit || null,
      }),
    );
  }
  if (data.remarks.trim()) {
    children.push(remarksNode(schema, data.remarks));
  }

  return rowNodeSchema.create({}, children);
}

export function applySupportEquipRowUpdate(
  editor: Editor,
  pos: number,
  data: SupportEquipRowData,
  rowNodeType: EquipRowNodeType = "supportEquipDescr",
): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== rowNodeType) return;
  const identNumberNode = findChild(current, "identNumber");
  const next = buildSupportEquipRowNode(
    editor.schema,
    data,
    rowNodeType,
    identNumberNode,
  );
  editor.view.dispatch(
    editor.state.tr.replaceWith(pos, pos + current.nodeSize, next),
  );
}

function equipCfgForRowType(rowNodeType: EquipRowNodeType) {
  for (const entry of Object.entries(REQ_EQUIP_DESCR_CONFIG)) {
    const [reqType, cfg] = entry as [EquipReqContainerType, (typeof REQ_EQUIP_DESCR_CONFIG)[EquipReqContainerType]];
    if (cfg.rowType === rowNodeType) return { reqType, ...cfg };
  }
  return null;
}

function countEquipRowsInGroup(
  group: PMNode,
  rowNodeType: EquipRowNodeType,
): number {
  let count = 0;
  group.forEach((child) => {
    if (child.type.name === rowNodeType) count += 1;
  });
  return count;
}

/** 将 `reqSupportEquips` 等整块内容替换为 `noSupportEquips` 等空占位。 */
export function replaceReqEquipWithNoPlaceholder(
  editor: Editor,
  reqPos: number,
  reqType: EquipReqContainerType,
): void {
  const cfg = REQ_EQUIP_DESCR_CONFIG[reqType];
  const req = editor.state.doc.nodeAt(reqPos);
  if (!req || req.type.name !== reqType) return;

  const noSchema = editor.schema.nodes[cfg.noType];
  if (!noSchema) return;

  const from = reqPos + 1;
  const to = from + req.content.size;
  editor.view.dispatch(
    editor.state.tr.replaceWith(from, to, noSchema.create()),
  );
}

export function deleteSupportEquipRow(
  editor: Editor,
  pos: number,
  rowNodeType: EquipRowNodeType = "supportEquipDescr",
): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== rowNodeType) return;

  const cfg = equipCfgForRowType(rowNodeType);
  if (!cfg) {
    editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize));
    return;
  }

  const $pos = editor.state.doc.resolve(pos);
  let reqPos: number | null = null;
  let groupNode: PMNode | null = null;
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name;
    if (name === cfg.groupType) groupNode = $pos.node(d);
    if (name === cfg.reqType) {
      reqPos = $pos.before(d);
      break;
    }
  }

  if (reqPos == null || !groupNode) {
    editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize));
    return;
  }

  if (countEquipRowsInGroup(groupNode, rowNodeType) <= 1) {
    replaceReqEquipWithNoPlaceholder(editor, reqPos, cfg.reqType);
    return;
  }

  editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize));
}

export function insertSupportEquipRowAtEnd(
  editor: Editor,
  supportEquipGroupPos: number,
  groupNodeType: EquipGroupNodeType = "supportEquipDescrGroup",
  rowNodeType: EquipRowNodeType = "supportEquipDescr",
): void {
  const group = editor.state.doc.nodeAt(supportEquipGroupPos);
  if (!group || group.type.name !== groupNodeType) return;

  const insertPos = supportEquipGroupPos + 1 + group.content.size;
  const row = buildSupportEquipRowNode(
    editor.schema,
    defaultSupportEquipRowData(),
    rowNodeType,
  );
  editor.view.dispatch(editor.state.tr.insert(insertPos, row));
}

/** 将 `noSupportEquips` / `noSupplies` / `noSpares` 替换为含一行的 descr 组，或向已有组追加一行。 */
export function insertFirstEquipDescrGroupAtReq(
  editor: Editor,
  reqPos: number,
  reqType: EquipReqContainerType,
): void {
  const cfg = REQ_EQUIP_DESCR_CONFIG[reqType];
  const req = editor.state.doc.nodeAt(reqPos);
  if (!req || req.type.name !== reqType) return;

  const groupSchema = editor.schema.nodes[cfg.groupType];
  if (!groupSchema) return;

  const row = buildSupportEquipRowNode(
    editor.schema,
    defaultSupportEquipRowData(),
    cfg.rowType,
  );

  if (req.childCount === 1 && req.firstChild?.type.name === cfg.noType) {
    const group = groupSchema.create({}, row);
    const from = reqPos + 1;
    const to = from + req.firstChild.nodeSize;
    editor.view.dispatch(editor.state.tr.replaceWith(from, to, group));
    return;
  }

  if (req.firstChild?.type.name === cfg.groupType) {
    insertSupportEquipRowAtEnd(editor, reqPos + 1, cfg.groupType, cfg.rowType);
  }
}
