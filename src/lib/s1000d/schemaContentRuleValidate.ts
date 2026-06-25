import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";

import type { Transaction } from "@tiptap/pm/state";



import type { DescriptionSchema } from "../../types/descriptionSchema";

import {
  contentRuleMentions,
  firstTopLevelContentBranch,
  flattenContentAlternative,
  parseContentSegments,
  splitTopLevelAlternatives,
} from "./contentRuleParse";

import { getDmContentKind } from "./dmContentKind";



const LOOSE_PARA_TYPES = new Set(["para", "paragraph"]);



const ATTENTION_TYPES = new Set(["warning", "caution", "note"]);



const FMFT_TYPES = new Set(["figure", "multimedia", "table"]);



/** 编辑器专用节点 → schema content token */

const EDITOR_NODE_TO_TOKENS: Record<string, string[]> = {

  catalogSeqNumberGroup: ["catalogSeqNumber"],

  bulletList: ["randomList", "listElemGroup"],

  orderedList: ["sequentialList", "listElemGroup"],

  paragraph: ["para"],

};



function schemaTokensForEditorNode(

  nodeTypeName: string,

  schema: DescriptionSchema,

): string[] {

  const mapped = EDITOR_NODE_TO_TOKENS[nodeTypeName];

  if (mapped) return mapped;

  if (Object.prototype.hasOwnProperty.call(schema, nodeTypeName)) {

    return [nodeTypeName];

  }

  if (LOOSE_PARA_TYPES.has(nodeTypeName)) return ["para"];

  if (ATTENTION_TYPES.has(nodeTypeName)) return ["attentionElemGroup"];

  if (FMFT_TYPES.has(nodeTypeName)) {

    const tokens = [nodeTypeName];

    if (schema[nodeTypeName]?.group?.split(/\s+/).includes("fmftElemGroup")) {

      tokens.push("fmftElemGroup");

    }

    return tokens;

  }

  return [nodeTypeName];

}



function tokenMatchesNodeType(

  token: string,

  nodeTypeName: string,

  schema: DescriptionSchema,

): boolean {

  if (token === nodeTypeName) return true;

  if (schemaTokensForEditorNode(nodeTypeName, schema).includes(token)) {

    return true;

  }

  if (token === "fmftElemGroup" && FMFT_TYPES.has(nodeTypeName)) return true;

  if (token === "attentionElemGroup" && ATTENTION_TYPES.has(nodeTypeName)) {

    return true;

  }

  if (token === "para" && LOOSE_PARA_TYPES.has(nodeTypeName)) return true;

  if (token === "catalogSeqNumber" && nodeTypeName === "catalogSeqNumberGroup") {

    return true;

  }

  const group = schema[nodeTypeName]?.group;

  if (group && group.split(/\s+/).includes(token)) return true;

  return false;

}



/** 节点类型是否出现在 content 规则的任一 segment 中。 */

export function nodeTypeAllowedInContentRule(

  nodeTypeName: string,

  rule: string,

  schema: DescriptionSchema,

): boolean {

  const segments = parseContentSegments(rule);

  if (segments.length === 0) return false;

  for (const segment of segments) {
    for (const alt of segment.alternatives) {
      for (const token of flattenContentAlternative(alt)) {
        if (tokenMatchesNodeType(token, nodeTypeName, schema)) return true;
      }
    }
  }

  for (const token of schemaTokensForEditorNode(nodeTypeName, schema)) {
    if (contentRuleMentions(rule, token)) return true;
  }

  return false;

}



/** 根据 `doc` 顶层子节点推断描述类 OR 规则当前所在分支；空文档取第一支。 */

export function inferDescriptionBranchIndex(

  doc: PMNode,

  branches: string[],

  schema: DescriptionSchema,

): number {

  if (branches.length <= 1 || doc.childCount === 0) return 0;



  for (let b = 0; b < branches.length; b++) {

    let matches = true;

    for (let i = 0; i < doc.childCount; i++) {

      if (

        !nodeTypeAllowedInContentRule(

          doc.child(i).type.name,

          branches[b],

          schema,

        )

      ) {

        matches = false;

        break;

      }

    }

    if (matches) return b;

  }



  const firstChild = doc.child(0).type.name;

  for (let b = 0; b < branches.length; b++) {

    if (nodeTypeAllowedInContentRule(firstChild, branches[b], schema)) {

      return b;

    }

  }

  return 0;

}



function resolveDescriptionContentRule(

  schema: DescriptionSchema,

  doc?: PMNode,

): string {

  const full = schema.description?.content ?? "";

  const branches = splitTopLevelAlternatives(full);

  if (branches.length <= 1) return full;

  if (!doc) return branches[0];

  const index = inferDescriptionBranchIndex(doc, branches, schema);

  return branches[index] ?? branches[0];

}



/** 编辑器内父容器 → schema `content` 规则字符串。 */

export function resolveSchemaContentRuleForEditorParent(

  parentTypeName: string,

  schema: DescriptionSchema,

  doc?: PMNode,

): string {

  const kind = getDmContentKind(schema);

  switch (parentTypeName) {

    case "doc":

      switch (kind) {

        case "ipd":

          return schema.illustratedPartsCatalog?.content ?? "";

        case "procedure":

          return schema.procedure?.content ?? "";

        case "crew":

          return schema.crew?.content ?? "";

        case "faultIsolation":

          return schema.faultIsolation?.content ?? "";

        default:

          return resolveDescriptionContentRule(schema, doc);

      }

    case "levelledPara":

      return schema.levelledPara?.content ?? "";

    case "proceduralStep":

      return schema.proceduralStep?.content ?? "";

    case "mainProcedure":

      return schema.mainProcedure?.content ?? "";

    case "preliminaryRqmts":

      return schema.preliminaryRqmts?.content ?? "";

    case "closeRqmts":

      return schema.closeRqmts?.content ?? "";

    case "catalogSeqNumberGroup":

      return schema.catalogSeqNumber?.content ?? "catalogSeqNumber+";

    case "faultIsolationProcedure":

      return schema.faultIsolationProcedure?.content ?? "";

    case "isolationMainProcedure":

      return schema.isolationMainProcedure?.content ?? "";

    case "isolationProcedure":

      return schema.isolationProcedure?.content ?? "";

    case "isolationStep":

      return schema.isolationStep?.content ?? "";

    default:

      return schema[parentTypeName]?.content ?? "";

  }

}



/** 该容器是否允许直接子节点为 `para` / `paragraph`。 */

export function containerAllowsLooseParaChild(

  parentTypeName: string,

  schema: DescriptionSchema,

  doc?: PMNode,

): boolean {

  const rule = resolveSchemaContentRuleForEditorParent(

    parentTypeName,

    schema,

    doc,

  );

  return nodeTypeAllowedInContentRule("para", rule, schema);

}



/** 宿主块（figure 等）后是否允许插入 trailing `para`。 */

export function containerAllowsTrailingPara(

  parentTypeName: string,

  schema: DescriptionSchema,

  doc?: PMNode,

): boolean {

  return containerAllowsLooseParaChild(parentTypeName, schema, doc);

}



/** 子节点是否为该容器下非法的 loose `para` / `paragraph`。 */

export function isIllegalLooseParaInContainer(

  parentTypeName: string,

  childTypeName: string,

  schema: DescriptionSchema,

  doc?: PMNode,

): boolean {

  if (!LOOSE_PARA_TYPES.has(childTypeName)) return false;

  const docRoot = parentTypeName === "doc" ? doc : undefined;

  return !containerAllowsLooseParaChild(parentTypeName, schema, docRoot);

}



function shouldScanContainer(typeName: string, schema: DescriptionSchema): boolean {

  return Boolean(resolveSchemaContentRuleForEditorParent(typeName, schema).trim());

}



/** 统计文档中非法 loose `para` / `paragraph` 数量。 */

export function countIllegalLooseParas(

  doc: PMNode,

  schema: DescriptionSchema,

): number {

  let count = 0;

  doc.descendants((node, _pos, parent) => {

    if (!parent) return;

    if (

      isIllegalLooseParaInContainer(

        parent.type.name,

        node.type.name,

        schema,

        parent.type.name === "doc" ? doc : undefined,

      )

    ) {

      count++;

    }

  });

  return count;

}



/** 收集文档树中不符合 schema 的 loose `para` / `paragraph` 区间。 */

export function collectIllegalLooseParaRanges(

  doc: PMNode,

  schema: DescriptionSchema,

): { from: number; to: number }[] {

  const ranges: { from: number; to: number }[] = [];



  doc.descendants((node, pos, parent) => {

    if (!parent) return;

    if (!shouldScanContainer(parent.type.name, schema)) return;

    if (

      !isIllegalLooseParaInContainer(

        parent.type.name,

        node.type.name,

        schema,

        parent.type.name === "doc" ? doc : undefined,

      )

    ) {

      return;

    }

    const to = pos + node.nodeSize;

    if (to > doc.content.size) return;

    ranges.push({ from: pos, to });

  });



  return ranges;

}



/** 按 `from` 降序安全删除非法 loose `para` / `paragraph`。 */

export function deleteIllegalLooseParaRanges(

  tr: Transaction,

  ranges: { from: number; to: number }[],

): boolean {

  if (ranges.length === 0) return false;



  const sorted = [...ranges].sort((a, b) => b.from - a.from);

  let changed = false;



  for (const { from, to } of sorted) {

    const size = tr.doc.content.size;

    if (from < 0 || to > size || from >= to) continue;

    const node = tr.doc.nodeAt(from);

    if (!node || !LOOSE_PARA_TYPES.has(node.type.name)) continue;

    if (to !== from + node.nodeSize) continue;

    tr.delete(from, to);

    changed = true;

  }



  return changed;

}



/** 导出 JSON 时过滤 `doc` 下非法 loose `para` / `paragraph`。 */

export function filterDocChildrenForSchemaExport(

  children: { type?: string }[],

  schema: DescriptionSchema,

): { type?: string }[] {

  return children.filter(

    (child) =>

      !isIllegalLooseParaInContainer("doc", child.type ?? "", schema),

  );

}



/**

 * 当前 `TextSelection` 是否落在 schema 不允许 loose `para` 的位置

 *（如图解类 `doc` 末尾间隙、非法 `doc` 直系 `para` 内）。

 */

export function isIllegalTextCursorPos(

  $pos: ResolvedPos,

  schema: DescriptionSchema,

): boolean {

  const doc = $pos.node(0);



  for (let d = $pos.depth; d > 0; d--) {

    const node = $pos.node(d);

    if (!LOOSE_PARA_TYPES.has(node.type.name)) continue;

    const parent = $pos.node(d - 1);

    return isIllegalLooseParaInContainer(

      parent.type.name,

      node.type.name,

      schema,

      parent.type.name === "doc" ? doc : undefined,

    );

  }



  if (

    $pos.parent.type.name === "doc" &&

    !containerAllowsLooseParaChild("doc", schema, doc)

  ) {

    return true;

  }



  return false;

}



/** 点击非法文本区时，回退为选中点击位置之前最近的顶层块。 */

export function resolveBlockNodeSelectionBeforePos(

  doc: PMNode,

  clickPos: number,

): number | null {

  let pos = 1;

  let lastBlockPos: number | null = null;

  for (let i = 0; i < doc.childCount; i++) {

    const child = doc.child(i);

    if (pos <= clickPos && child.isBlock) {

      lastBlockPos = pos;

    }

    pos += child.nodeSize;

  }

  return lastBlockPos;

}



export { firstTopLevelContentBranch };


