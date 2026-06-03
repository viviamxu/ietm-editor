import type { Editor } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";

import { getProcedureDictionaries } from "../../store/procedureDictionaryStore";
import type { ProcedureDictionaries } from "../../types/procedureDictionaries";

export type PersonnelRowData = {
  numRequired: string;
  personCategoryCode: string;
  skillLevelCode: string;
  trade: string;
  estimatedTime: string;
  unitOfMeasure: string;
};

function firstCode(
  list: ProcedureDictionaries["personCategory"],
  fallback: string,
): string {
  return list[0]?.code ?? fallback;
}

/** 新建人员行时的默认值（取当前字典首项）。 */
export function defaultPersonnelRowData(): PersonnelRowData {
  const dict = getProcedureDictionaries();
  return {
    numRequired: "1",
    personCategoryCode: firstCode(dict.personCategory, "pcc01"),
    skillLevelCode: firstCode(dict.personSkill, "sk01"),
    trade: "",
    estimatedTime: "",
    unitOfMeasure: firstCode(dict.timeUnit, "h"),
  };
}

function findChild(node: PMNode, typeName: string): PMNode | null {
  let found: PMNode | null = null;
  node.forEach((child) => {
    if (child.type.name === typeName) found = child;
  });
  return found;
}

export function readPersonnelRowData(node: PMNode): PersonnelRowData {
  const category = findChild(node, "personCategory");
  const skill = findChild(node, "personSkill");
  const trade = findChild(node, "trade");
  const estimated = findChild(node, "estimatedTime");

  return {
    numRequired: String(node.attrs.numRequired ?? "1"),
    personCategoryCode: String(
      category?.attrs.personCategoryCode ?? "",
    ).trim(),
    skillLevelCode: String(skill?.attrs.skillLevelCode ?? "").trim(),
    trade: trade?.textContent ?? "",
    estimatedTime: estimated?.textContent ?? "",
    unitOfMeasure: String(estimated?.attrs.unitOfMeasure ?? "h").trim() || "h",
  };
}

function inlineTextNode(
  schema: Schema,
  typeName: string,
  text: string,
  attrs?: Record<string, string | null>,
): PMNode {
  const type = schema.nodes[typeName];
  if (!type) {
    throw new Error(`Missing schema node: ${typeName}`);
  }
  const content = text ? schema.text(text) : undefined;
  return type.create(attrs ?? {}, content);
}

export function buildPersonnelRowNode(
  schema: Schema,
  data: PersonnelRowData,
): PMNode {
  const personnelType = schema.nodes.personnel;
  const categoryType = schema.nodes.personCategory;
  const skillType = schema.nodes.personSkill;
  if (!personnelType || !categoryType || !skillType) {
    throw new Error("Personnel schema nodes are not registered");
  }

  const numRequired =
    data.numRequired.trim() !== "" ? data.numRequired.trim() : "1";

  return personnelType.create({ numRequired }, [
    categoryType.create({
      personCategoryCode: data.personCategoryCode || null,
    }),
    skillType.create({
      skillLevelCode: data.skillLevelCode || null,
    }),
    inlineTextNode(schema, "trade", data.trade),
    inlineTextNode(schema, "estimatedTime", data.estimatedTime, {
      unitOfMeasure: data.unitOfMeasure || "h",
    }),
  ]);
}

export function applyPersonnelRowUpdate(
  editor: Editor,
  pos: number,
  data: PersonnelRowData,
): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== "personnel") return;

  const next = buildPersonnelRowNode(editor.schema, data);
  editor.view.dispatch(
    editor.state.tr.replaceWith(pos, pos + current.nodeSize, next),
  );
}

export function deletePersonnelRow(editor: Editor, pos: number): void {
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== "personnel") return;
  editor.view.dispatch(editor.state.tr.delete(pos, pos + current.nodeSize));
}

export function insertPersonnelRowAtEnd(editor: Editor, reqPersonsPos: number): void {
  const reqPersons = editor.state.doc.nodeAt(reqPersonsPos);
  if (!reqPersons || reqPersons.type.name !== "reqPersons") return;

  const insertPos = reqPersonsPos + 1 + reqPersons.content.size;
  const row = buildPersonnelRowNode(editor.schema, defaultPersonnelRowData());
  editor.view.dispatch(editor.state.tr.insert(insertPos, row));
}
