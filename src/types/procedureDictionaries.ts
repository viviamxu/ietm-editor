/** 程序类人员/工时等下拉字典项（code 写入 S1000D XML 属性，label 仅用于 UI）。 */
export type ProcedureDictionaryOption = {
  code: string;
  label: string;
};

export type ProcedureDictionaries = {
  personCategory: ProcedureDictionaryOption[];
  personSkill: ProcedureDictionaryOption[];
  timeUnit: ProcedureDictionaryOption[];
};
