export type IsolationFlowBranchMode = "是否分支" | "自定义分支";

export type IsolationFlowStepBranchData = {
  branchMode?: IsolationFlowBranchMode;
  customBranchOptions?: string[];
};

/** 当前分支模式下画布上可见的步骤输出点 handle id。 */
export function visibleOutputHandles(
  data: IsolationFlowStepBranchData,
): string[] {
  const mode = data.branchMode ?? "是否分支";
  if (mode === "是否分支") {
    return ["branch-yes", "branch-no"];
  }
  const count = Math.max(data.customBranchOptions?.length ?? 1, 1);
  return Array.from({ length: count }, (_, i) => `branch-custom-${i}`);
}

/** 连线是否挂在当前可见的输出点上（用于展示；非步骤源视为可见）。 */
export function isEdgeOnVisibleSourceHandle(
  sourceNodeType: string | undefined,
  sourceNodeData: IsolationFlowStepBranchData | undefined,
  sourceHandle: string | null | undefined,
): boolean {
  if (sourceNodeType !== "isolationStep") return true;

  const handle = sourceHandle ?? null;
  if (!handle) return true;

  return visibleOutputHandles(sourceNodeData ?? {}).includes(handle);
}
