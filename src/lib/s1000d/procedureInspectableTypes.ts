import procedureSchema from "../../data/程序类.json";
import type { DescriptionSchema } from "../../types/descriptionSchema";

/** 程序类 `<content>/<procedure>` 内：光标在内层文本壳上时，优先检视外层块节点。 */
export const PROCEDURE_TEXT_SHELL_NODE_TYPES = [
  "reqCond",
  "personCategory",
  "personSkill",
  "trade",
  "estimatedTime",
  "partNumber",
  "name",
  "natoStockNumber",
  "reqQuantity",
  "remarks",
  "identNumber",
  "partAndSerialNumber",
] as const;

/** `proceduralStep` / `safetyRqmts` 正文共用的 Phase1 块（不在 `procedure` 子树 JSON 遍历内时需手动并入）。 */
const PROCEDURE_PHASE1_BLOCK_TYPES = [
  "para",
  "title",
  "warning",
  "caution",
  "note",
  "notePara",
  "noteLead",
  "warningAndCautionPara",
  "warningAndCautionLead",
  "attentionRandomList",
  "attentionRandomListItem",
  "attentionListItemPara",
  "figure",
  "graphic",
  "multimedia",
  "multimediaObject",
  "parameter",
  "table",
  "tgroup",
  "thead",
  "tbody",
  "tfoot",
  "row",
  "entry",
  "bulletList",
  "orderedList",
  "listItem",
] as const;

function tokenizeContentModel(content: string | undefined): string[] {
  if (!content) return [];
  return content
    .replace(/\([^)]*\)/g, " ")
    .replace(/\|/g, " ")
    .replace(/\*/g, " ")
    .replace(/\?/g, " ")
    .replace(/\+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** S1000D 内容模型占位符 / PM 内置类型，不是可注册块元素。 */
const CONTENT_MODEL_NON_ELEMENT = new Set(["text", "inline"]);

/** 自 `procedure` 起沿 `程序类.json` 内容模型可达的全部**元素**名（不含 `text` 等占位符）。 */
export function collectProcedureContentNodeNames(
  schema: DescriptionSchema = procedureSchema as DescriptionSchema,
): Set<string> {
  const seen = new Set<string>();
  const queue = ["procedure"];

  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    if (!schema[name]) continue;
    seen.add(name);

    const rule = schema[name];
    for (const child of tokenizeContentModel(rule.content)) {
      if (CONTENT_MODEL_NON_ELEMENT.has(child)) continue;
      if (!schema[child]) continue;
      if (!seen.has(child)) queue.push(child);
    }
  }

  return seen;
}

/** `s1000dProcedureNodes` 注册的程序类专用节点，排除 inline 文本壳（全局 `id` 仅挂这些类型）。 */
export const S1000D_PROCEDURE_NATIVE_NODE_NAMES = [
  "preliminaryRqmts",
  "mainProcedure",
  "closeRqmts",
  "proceduralStep",
  "reqCondGroup",
  "reqCondNoRef",
  "noConds",
  "reqPersons",
  "personnel",
  "reqSupportEquips",
  "noSupportEquips",
  "supportEquipDescrGroup",
  "supportEquipDescr",
  "reqSupplies",
  "noSupplies",
  "supplyDescrGroup",
  "supplyDescr",
  "reqSpares",
  "noSpares",
  "spareDescrGroup",
  "spareDescr",
  "reqSafety",
  "noSafety",
  "safetyRqmts",
] as const;

const PROCEDURE_CONTENT_NODE_NAMES = collectProcedureContentNodeNames();

/** 程序类正文块：JSON 可达 + Phase1 共用块，排除文本壳。 */
export const PROCEDURE_BLOCK_INSPECTABLE_TYPES = [
  ...[...PROCEDURE_CONTENT_NODE_NAMES].filter(
    (name) =>
      !PROCEDURE_TEXT_SHELL_NODE_TYPES.includes(
        name as (typeof PROCEDURE_TEXT_SHELL_NODE_TYPES)[number],
      ),
  ),
  ...PROCEDURE_PHASE1_BLOCK_TYPES.filter(
    (name) => !PROCEDURE_CONTENT_NODE_NAMES.has(name),
  ),
] as const;

export const PROCEDURE_BLOCK_INSPECTABLE_TYPE_SET = new Set<string>(
  PROCEDURE_BLOCK_INSPECTABLE_TYPES,
);

/** 程序类专用块节点：全局挂 `id`（不含 Phase1 与文本壳）。 */
export const PROCEDURE_NATIVE_BLOCK_ID_TYPES = [
  ...S1000D_PROCEDURE_NATIVE_NODE_NAMES,
] as const;

/** 程序类模式下 `resolveInspectable` 使用的延迟 / 外层优先集合。 */
export const PROCEDURE_INNER_INSPECT_DEFER = new Set<string>([
  ...PROCEDURE_TEXT_SHELL_NODE_TYPES,
  "para",
  "paragraph",
  "notePara",
  "warningAndCautionPara",
  "title",
]);

export const PROCEDURE_OUTRANKS_INNER_DEFER = new Set<string>([
  ...PROCEDURE_BLOCK_INSPECTABLE_TYPE_SET,
]);
