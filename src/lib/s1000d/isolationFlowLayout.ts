import dagre from "@dagrejs/dagre";

/** 与 `.ife-node { width: 320px }` 一致。 */
export const ISOLATION_FLOW_NODE_WIDTH = 320;

type BranchMode = "是否分支" | "自定义分支";

type LayoutNode = {
  id: string;
  type: "isolationStep" | "isolationEnd";
  position: { x: number; y: number };
  data: {
    branchMode?: BranchMode;
    customBranchOptions?: string[];
  };
};

type LayoutEdge = {
  source: string;
  target: string;
};

/** 按节点类型与分支内容估算卡片高度（与编排器 CSS 大致对齐）。 */
export function estimateIsolationFlowNodeHeight(
  node: Pick<LayoutNode, "type" | "data">,
): number {
  if (node.type === "isolationEnd") {
    return 200;
  }

  const branchMode = node.data.branchMode ?? "是否分支";
  let h = 44 + 20 + 109 + 109 + 40;

  if (branchMode === "自定义分支") {
    const optionCount = Math.max(node.data.customBranchOptions?.length ?? 1, 1);
    h += optionCount * 36 + 44;
  } else {
    h += 88;
  }

  return Math.max(h, 300);
}

function layoutIsolationFlowList<T extends LayoutNode>(nodes: T[]): T[] {
  let y = 40;
  return nodes.map((node) => {
    const height = estimateIsolationFlowNodeHeight(node);
    const positioned = {
      ...node,
      position: { x: 40, y },
    };
    y += height + 80;
    return positioned;
  });
}

/** 使用 Dagre 对隔离流程图做分层布局。 */
export function layoutIsolationFlowGraph<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  direction: "TB" | "LR" = "TB",
): T[] {
  if (nodes.length === 0) return nodes;
  if (edges.length === 0) return layoutIsolationFlowList(nodes);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 72,
    ranksep: 96,
    marginx: 48,
    marginy: 48,
  });

  for (const node of nodes) {
    g.setNode(node.id, {
      width: ISOLATION_FLOW_NODE_WIDTH,
      height: estimateIsolationFlowNodeHeight(node),
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const laid = g.node(node.id) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    if (!laid) return node;
    return {
      ...node,
      position: {
        x: laid.x - laid.width / 2,
        y: laid.y - laid.height / 2,
      },
    };
  });
}
