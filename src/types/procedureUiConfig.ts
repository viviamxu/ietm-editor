/** 程序类 UI 表格展示方式（列映射后续扩展）。 */
export type ProcedureSectionPresentation = "block" | "table";

/** 大纲树节点：节点类型 → 显示标题；子节点顺序决定固定编号。 */
export type ProcedureOutlineEntry = {
  node: string;
  label: string;
  presentation?: ProcedureSectionPresentation;
  tableKey?: string;
  /** 同类型可重复出现（如 proceduralStep） */
  repeatable?: boolean;
  /** 可嵌套（如 proceduralStep 内 proceduralStep） */
  nestable?: boolean;
  children?: ProcedureOutlineEntry[];
};

/** 章节编号展示规则（仅 UI，不写 XML）。 */
export type ProcedureNumberingConfig = {
  enabled: boolean;
  separator: string;
  /** 拼在完整编号末尾，如 "." → "1.2." */
  suffix: string;
};

export type ProcedureUiConfig = {
  numbering: ProcedureNumberingConfig;
  procedureOutline: ProcedureOutlineEntry[];
};

export type ProcedureSectionHeading = {
  number: string;
  label: string;
  /** 编号 + 标题，如 "1.2 人员要求" */
  full: string;
};
