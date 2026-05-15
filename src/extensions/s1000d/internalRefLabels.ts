/** S1000D `internalRefTargetType`（节选）→ 悬浮 Popover 短标签 */
const INTERNAL_REF_TARGET_TYPE_LABELS: Record<string, string> = {
  irtt01: "图",
  irtt02: "表",
  irtt03: "段落",
};

/** 文档节点类型名 → Popover 短标签 */
const INTERNAL_REF_NODE_TYPE_LABELS: Record<string, string> = {
  figure: "图",
  graphic: "图",
  table: "表格",
  para: "段落",
  levelledPara: "层级段落",
  warning: "警告",
  caution: "注意",
  note: "注释",
  title: "标题",
};

export function describeInternalRefTargetType(code?: string | null): string {
  if (!code) return "内部引用";
  return INTERNAL_REF_TARGET_TYPE_LABELS[code] ?? code;
}

/** 按目标节点类型名解析 Popover 展示用短标签 */
export function describeInternalRefNodeType(nodeType?: string | null): string {
  if (!nodeType) return "引用";
  return INTERNAL_REF_NODE_TYPE_LABELS[nodeType] ?? nodeType;
}

/** Popover 文案：`段落：p1` */
export function formatInternalRefPopoverLabel(
  typeLabel: string,
  refId: string,
): string {
  const id = refId.trim();
  return `${typeLabel}：${id || "（未设置）"}`;
}
