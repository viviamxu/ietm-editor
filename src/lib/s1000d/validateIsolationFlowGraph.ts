import {
  visibleOutputHandles,
  type IsolationFlowBranchMode,
} from "./isolationFlowGraphHandles";

export type IsolationFlowValidationNode = {
  id: string;
  type?: string;
  data: {
    title?: string;
    branchMode?: IsolationFlowBranchMode;
    customBranchOptions?: string[];
  };
};

export type IsolationFlowValidationEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
};

function nodeLabel(
  node: IsolationFlowValidationNode,
  kind: "步骤" | "结束",
): string {
  const title = node.data.title?.trim();
  return title ? `「${title}」` : `未命名${kind}`;
}

function outputHandleLabel(
  node: IsolationFlowValidationNode,
  handleId: string,
): string {
  if (handleId === "branch-yes") return "「是」";
  if (handleId === "branch-no") return "「否」";

  const match = /^branch-custom-(\d+)$/.exec(handleId);
  if (!match) return handleId;

  const index = Number.parseInt(match[1], 10);
  const option = node.data.customBranchOptions?.[index]?.trim();
  return option ? `「${option}」` : `「分支 ${index + 1}」`;
}

function countOutgoingEdges(
  edges: IsolationFlowValidationEdge[],
  sourceId: string,
  sourceHandle: string,
): number {
  return edges.filter(
    (e) =>
      e.source === sourceId &&
      (e.sourceHandle ?? null) === sourceHandle,
  ).length;
}

/** 隔离流程画布内容校验；返回所有问题描述（空数组表示通过）。 */
export function validateIsolationFlowGraph(
  nodes: IsolationFlowValidationNode[],
  edges: IsolationFlowValidationEdge[],
): string[] {
  const issues: string[] = [];

  // 规则 1：可见输出点各有且仅有 1 条连线
  for (const node of nodes) {
    if (node.type !== "isolationStep") continue;

    const label = nodeLabel(node, "步骤");
    for (const handleId of visibleOutputHandles(node.data)) {
      const count = countOutgoingEdges(edges, node.id, handleId);
      const handleLabel = outputHandleLabel(node, handleId);

      if (count === 0) {
        issues.push(`${label} 的 ${handleLabel} 输出点未连接`);
      } else if (count > 1) {
        issues.push(
          `${label} 的 ${handleLabel} 输出点连接了 ${count} 条连线，只能有 1 条`,
        );
      }
    }
  }

  // 规则 2：全图恰好 1 个节点输入点未被连接（唯一起点）
  const nodesWithoutIncoming = nodes.filter(
    (n) => !edges.some((e) => e.target === n.id),
  );
  if (nodesWithoutIncoming.length === 0) {
    issues.push("画布中不存在流程起点（没有任何节点的输入点未被连接）");
  } else if (nodesWithoutIncoming.length > 1) {
    issues.push(
      `画布中存在 ${nodesWithoutIncoming.length} 个流程起点，只能有 1 个`,
    );
  }

  // 规则 3：至少 1 个流程结束节点
  const endNodes = nodes.filter((n) => n.type === "isolationEnd");
  if (endNodes.length === 0) {
    issues.push("画布中必须至少包含 1 个「流程结束」组件");
  }

  // 规则 4：所有结束节点输入点必须被连接
  for (const end of endNodes) {
    const hasIncoming = edges.some((e) => e.target === end.id);
    if (!hasIncoming) {
      issues.push(
        `「流程结束」${nodeLabel(end, "结束")} 的输入点未连接`,
      );
    }
  }

  return issues;
}
