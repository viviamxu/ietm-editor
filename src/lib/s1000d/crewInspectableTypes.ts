/** 操作类专用块节点：全局挂 `id`（与 `blockTagParseRules` 配合）。 */
export const CREW_NATIVE_BLOCK_ID_TYPES = [
  "crewDrillStep",
  "crewDrill",
  "if",
  "elseIf",
  "case",
] as const;

/** 操作类条件块（`caseCond` 的宿主）。 */
export const CREW_CONDITION_BLOCK_TYPES = ["if", "elseIf", "case"] as const;

/** 操作类模式下属性面板可检视的块节点。 */
export const CREW_BLOCK_INSPECTABLE_TYPES = [
  ...CREW_CONDITION_BLOCK_TYPES,
  "crewDrill",
  "crewDrillStep",
] as const;

export const CREW_BLOCK_INSPECTABLE_TYPE_SET = new Set<string>(
  CREW_BLOCK_INSPECTABLE_TYPES,
);

/**
 * 光标在这些内层节点上时延迟检视，以便优先展示外层 `if` / `crewDrillStep` 等。
 * `para` 等通用延迟项在 `resolveInspectable` 中与基础集合合并。
 */
export const CREW_INNER_INSPECT_DEFER = new Set<string>(["caseCond"]);

export const CREW_OUTRANKS_INNER_DEFER = new Set<string>(
  CREW_BLOCK_INSPECTABLE_TYPES,
);
