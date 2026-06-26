import type { Editor } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";

export type CatalogSeqNumberRowData = {
  id: string | null;
  indenture: string | null;
  figureNumber: string | null;
  item: string;
  itemSeqNumberValue: string | null;
  hotspotRefId: string;
  descrForPart: string;
  quantityPerNextHigherAssy: string;
  totalQuantity: string;
  overLengthPartNumber: string;
  partKeyword: string;
};

export type HotspotOption = {
  id: string;
  label: string;
};

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
): PMNode {
  const type = schema.nodes[typeName];
  if (!type) throw new Error(`Missing schema node: ${typeName}`);
  const content = text ? schema.text(text) : undefined;
  return type.create({}, content);
}

function readInlineText(node: PMNode | null): string {
  return node?.textContent ?? "";
}

export function defaultCatalogSeqNumberRowData(): CatalogSeqNumberRowData {
  return {
    id: null,
    indenture: null,
    figureNumber: null,
    item: "",
    itemSeqNumberValue: null,
    hotspotRefId: "",
    descrForPart: "",
    quantityPerNextHigherAssy: "",
    totalQuantity: "",
    overLengthPartNumber: "",
    partKeyword: "",
  };
}

export function readCatalogSeqNumberRowData(
  node: PMNode,
): CatalogSeqNumberRowData {
  const itemSeq = findChild(node, "itemSeqNumber");
  const partSegment = itemSeq ? findChild(itemSeq, "partSegment") : null;
  const itemIdentData = partSegment
    ? findChild(partSegment, "itemIdentData")
    : null;

  return {
    id: (node.attrs.id as string | null) ?? null,
    indenture: (node.attrs.indenture as string | null) ?? null,
    figureNumber: (node.attrs.figureNumber as string | null) ?? null,
    item: String(node.attrs.item ?? ""),
    itemSeqNumberValue:
      (itemSeq?.attrs.itemSeqNumberValue as string | null) ?? null,
    hotspotRefId: String(node.attrs.hotspotRefId ?? "").trim(),
    descrForPart: readInlineText(
      itemIdentData ? findChild(itemIdentData, "descrForPart") : null,
    ),
    quantityPerNextHigherAssy: readInlineText(
      itemSeq ? findChild(itemSeq, "quantityPerNextHigherAssy") : null,
    ),
    totalQuantity: readInlineText(
      itemSeq ? findChild(itemSeq, "totalQuantity") : null,
    ),
    overLengthPartNumber: readInlineText(
      itemIdentData ? findChild(itemIdentData, "overLengthPartNumber") : null,
    ),
    partKeyword: readInlineText(
      itemIdentData ? findChild(itemIdentData, "partKeyword") : null,
    ),
  };
}

export function buildCatalogSeqNumberRowNode(
  schema: Schema,
  data: CatalogSeqNumberRowData,
): PMNode {
  const rowType = schema.nodes.catalogSeqNumber;
  const itemSeqType = schema.nodes.itemSeqNumber;
  const partSegmentType = schema.nodes.partSegment;
  const itemIdentDataType = schema.nodes.itemIdentData;
  if (!rowType || !itemSeqType || !partSegmentType || !itemIdentDataType) {
    throw new Error("IPD catalogSeqNumber schema nodes are not registered");
  }

  const itemIdentChildren: PMNode[] = [];
  if (data.descrForPart.trim()) {
    itemIdentChildren.push(
      inlineTextNode(schema, "descrForPart", data.descrForPart),
    );
  }
  if (data.partKeyword.trim()) {
    itemIdentChildren.push(
      inlineTextNode(schema, "partKeyword", data.partKeyword),
    );
  }
  if (data.overLengthPartNumber.trim()) {
    itemIdentChildren.push(
      inlineTextNode(schema, "overLengthPartNumber", data.overLengthPartNumber),
    );
  }

  const itemIdentData = itemIdentDataType.create({}, itemIdentChildren);
  const partSegment = partSegmentType.create({}, itemIdentData);

  const itemSeqChildren: PMNode[] = [];
  if (data.quantityPerNextHigherAssy.trim()) {
    itemSeqChildren.push(
      inlineTextNode(
        schema,
        "quantityPerNextHigherAssy",
        data.quantityPerNextHigherAssy,
      ),
    );
  }
  if (data.totalQuantity.trim()) {
    itemSeqChildren.push(
      inlineTextNode(schema, "totalQuantity", data.totalQuantity),
    );
  }
  if (schema.nodes.partRef) {
    itemSeqChildren.push(
      schema.nodes.partRef.create({
        manufacturerCodeValue: "",
        partNumberValue: "",
      }),
    );
  }
  itemSeqChildren.push(partSegment);

  const itemSeq = itemSeqType.create(
    {
      itemSeqNumberValue: data.itemSeqNumberValue?.trim() || null,
    },
    itemSeqChildren,
  );

  return rowType.create(
    {
      id: data.id?.trim() || null,
      indenture: data.indenture?.trim() || null,
      figureNumber: data.figureNumber?.trim() || null,
      item: data.item.trim() || null,
      hotspotRefId: data.hotspotRefId.trim() || null,
    },
    itemSeq,
  );
}

export function applyCatalogSeqNumberRowUpdate(
  editor: Editor,
  pos: number,
  data: CatalogSeqNumberRowData,
): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== "catalogSeqNumber") return;
  const next = buildCatalogSeqNumberRowNode(editor.schema, data);
  editor.view.dispatch(
    editor.state.tr.replaceWith(pos, pos + current.nodeSize, next),
  );
}

export function deleteCatalogSeqNumberRow(editor: Editor, pos: number): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== "catalogSeqNumber") return;
  editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize));
}

export function insertCatalogSeqNumberRowAtEnd(
  editor: Editor,
  groupPos: number,
): void {
  const group = editor.state.doc.nodeAt(groupPos);
  if (!group || group.type.name !== "catalogSeqNumberGroup") return;
  const insertPos = groupPos + 1 + group.content.size;
  const row = buildCatalogSeqNumberRowNode(
    editor.schema,
    defaultCatalogSeqNumberRowData(),
  );
  editor.view.dispatch(editor.state.tr.insert(insertPos, row));
}

/** 收集当前文档 figure/graphic 下所有 hotspot id，供表格「热点ID」下拉。 */
export function collectHotspotOptions(doc: PMNode): HotspotOption[] {
  const options: HotspotOption[] = [];
  const seen = new Set<string>();

  doc.descendants((node) => {
    if (node.type.name !== "hotspot") return;
    const id = String(node.attrs.id ?? "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const title = String(node.attrs.hotspotTitle ?? "").trim();
    options.push({ id, label: title ? `${id} · ${title}` : id });
  });

  return options;
}
