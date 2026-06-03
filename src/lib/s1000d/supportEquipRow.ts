import type { Editor } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";

export type SupportEquipRowData = {
  name: string;
  natoStockNumber: string;
  reqQuantity: string;
  unitOfMeasure: string;
  remarks: string;
};

const DEFAULT_UNIT_OF_MEASURE = "set";
type EquipRowNodeType = "supportEquipDescr" | "supplyDescr" | "spareDescr";
type EquipGroupNodeType =
  | "supportEquipDescrGroup"
  | "supplyDescrGroup"
  | "spareDescrGroup";

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

export function defaultSupportEquipRowData(): SupportEquipRowData {
  return {
    name: "",
    natoStockNumber: "",
    reqQuantity: "",
    unitOfMeasure: DEFAULT_UNIT_OF_MEASURE,
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
    unitOfMeasure:
      String(reqQuantity?.attrs.unitOfMeasure ?? "").trim() ||
      DEFAULT_UNIT_OF_MEASURE,
    remarks: remarks?.textContent ?? "",
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
  if (data.reqQuantity.trim() || data.unitOfMeasure.trim()) {
    children.push(
      inlineTextNode(schema, "reqQuantity", data.reqQuantity, {
        unitOfMeasure: data.unitOfMeasure || DEFAULT_UNIT_OF_MEASURE,
      }),
    );
  }
  if (data.remarks.trim()) {
    children.push(inlineTextNode(schema, "remarks", data.remarks));
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

export function deleteSupportEquipRow(
  editor: Editor,
  pos: number,
  rowNodeType: EquipRowNodeType = "supportEquipDescr",
): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== rowNodeType) return;
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
