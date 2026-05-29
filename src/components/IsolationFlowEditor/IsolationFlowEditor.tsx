import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  ConnectionLineType,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import {
  CheckCircle2,
  CircleX,
  Copy,
  Flag,
  Redo2,
  Shield,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import "reactflow/dist/style.css";
import "../../styles/partials/isolation-flow-editor.css";
import {
  ISOLATION_FLOW_CHANNEL,
  payloadFromFlowSnapshot,
  readIsolationFlowPayload,
  type IsolationFlowNodeDataPayload,
} from "../../lib/s1000d/isolationFlowBridge";

type IsolationNodeType = "isolationStep" | "isolationEnd";
type BranchMode = "是否分支" | "自定义分支";

type IsolationNodeData = IsolationFlowNodeDataPayload & {
  onCopy?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onChange?: (
    nodeId: string,
    patch: Partial<
      Pick<
        IsolationFlowNodeDataPayload,
        "title" | "action" | "question" | "branchMode" | "customBranchOptions"
      >
    >,
  ) => void;
};

type FlowSnapshot = {
  nodes: Node<IsolationNodeData>[];
  edges: Edge[];
};

type HistoryState = {
  past: FlowSnapshot[];
  future: FlowSnapshot[];
};

const DRAG_MIME = "application/isolation-flow-node";

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DUPLICATE_OUTPUT_MESSAGE = "该分支输出点已连接目标节点，请先删除已有连线";

function isOutputHandleAlreadyUsed(
  edges: Edge[],
  connection: Connection,
): boolean {
  const sourceHandle = connection.sourceHandle ?? null;
  return edges.some(
    (edge) =>
      edge.source === connection.source &&
      (edge.sourceHandle ?? null) === sourceHandle,
  );
}

function IsolationStepNode({ id, data }: NodeProps<IsolationNodeData>) {
  const branchMode: BranchMode = data.branchMode ?? "是否分支";
  const customBranchOptions = useMemo(
    () => data.customBranchOptions ?? [""],
    [data.customBranchOptions],
  );

  const updateCustomOption = useCallback(
    (index: number, value: string) => {
      const nextOptions = customBranchOptions.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      );
      data.onChange?.(id, { customBranchOptions: nextOptions });
    },
    [customBranchOptions, data, id],
  );

  const addCustomOption = useCallback(() => {
    data.onChange?.(id, { customBranchOptions: [...customBranchOptions, ""] });
  }, [customBranchOptions, data, id]);

  return (
    <div className="ife-node ife-node-step">
      <Handle
        type="target"
        position={Position.Left}
        className="ife-handle ife-handle-target"
        isConnectableStart={false}
      />
      <div className="ife-node-header ife-node-header-step">
        <Shield size={14} color="#2563eb" />
        <input
          className="ife-node-title-input nodrag"
          value={data.title}
          onChange={(e) => data.onChange?.(id, { title: e.target.value })}
        />
        <button
          type="button"
          className="ife-node-header-icon-btn nodrag"
          onClick={() => data.onCopy?.(id)}
          aria-label="复制节点"
          title="复制"
        >
          <Copy size={14} className="ife-node-header-icon" />
        </button>
        <button
          type="button"
          className="ife-node-header-icon-btn nodrag"
          onClick={() => data.onDelete?.(id)}
          aria-label="删除节点"
          title="删除"
        >
          <X size={14} className="ife-node-header-icon" />
        </button>
      </div>

      <div className="ife-node-body">
        <label className="ife-node-label">动作</label>
        <textarea
          className="ife-node-textarea nodrag"
          value={data.action}
          onChange={(e) => data.onChange?.(id, { action: e.target.value })}
        />

        <label className="ife-node-label">问题</label>
        <textarea
          className="ife-node-textarea nodrag"
          value={data.question ?? ""}
          onChange={(e) => data.onChange?.(id, { question: e.target.value })}
        />

        <div className="ife-node-branch-row">
          <label className="ife-node-label">分支模式</label>
          <select
            className="ife-node-select nodrag"
            value={branchMode}
            onChange={(e) =>
              data.onChange?.(id, { branchMode: e.target.value as BranchMode })
            }
          >
            <option value="是否分支">是否分支</option>
            <option value="自定义分支">自定义分支</option>
          </select>
        </div>

        {branchMode === "是否分支" ? (
          <div className="ife-node-branch-fixed-list">
            <div className="ife-node-branch-fixed-item">
              是
              <Handle
                type="source"
                id="branch-yes"
                position={Position.Right}
                className="ife-handle ife-handle-source"
              />
            </div>
            <div className="ife-node-branch-fixed-item">
              否
              <Handle
                type="source"
                id="branch-no"
                position={Position.Right}
                className="ife-handle ife-handle-source"
              />
            </div>
          </div>
        ) : (
          <div className="ife-node-custom-branch-list">
            {customBranchOptions.map((option, index) => (
              <div
                key={`custom-branch-${index}`}
                className="ife-node-custom-branch-row"
              >
                <input
                  className="ife-node-custom-branch-input nodrag"
                  value={option}
                  placeholder="请输入分支选项"
                  onChange={(e) => updateCustomOption(index, e.target.value)}
                />
                <Handle
                  type="source"
                  id={`branch-custom-${index}`}
                  position={Position.Right}
                  className="ife-handle ife-handle-source"
                />
              </div>
            ))}
            <button
              type="button"
              className="ife-node-add-branch-btn nodrag"
              onClick={addCustomOption}
            >
              + 添加选项
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function IsolationEndNode({ id, data }: NodeProps<IsolationNodeData>) {
  return (
    <div className="ife-node ife-node-end">
      <Handle
        type="target"
        position={Position.Left}
        className="ife-handle ife-handle-target"
        isConnectableStart={false}
      />
      <div className="ife-node-header ife-node-header-end">
        <Flag size={14} color="#dc2626" />
        <input
          className="ife-node-title-input nodrag"
          value={data.title}
          onChange={(e) => data.onChange?.(id, { title: e.target.value })}
        />
        <button
          type="button"
          className="ife-node-header-icon-btn nodrag"
          onClick={() => data.onCopy?.(id)}
          aria-label="复制节点"
          title="复制"
        >
          <Copy size={14} className="ife-node-header-icon" />
        </button>
        <button
          type="button"
          className="ife-node-header-icon-btn nodrag"
          onClick={() => data.onDelete?.(id)}
          aria-label="删除节点"
          title="删除"
        >
          <X size={14} className="ife-node-header-icon" />
        </button>
      </div>

      <div className="ife-node-body">
        <label className="ife-node-label">动作</label>
        <textarea
          className="ife-node-textarea nodrag"
          value={data.action}
          onChange={(e) => data.onChange?.(id, { action: e.target.value })}
        />
      </div>
    </div>
  );
}

const nodeTypes = {
  isolationStep: IsolationStepNode,
  isolationEnd: IsolationEndNode,
};

function IsolationFlowEditorInner() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const procedureKeyRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get("key"),
  );
  const initialLoadedRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<IsolationNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewportReady, setViewportReady] = useState(false);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });
  const [toastMessage, setToastMessage] = useState("");
  const snapshotRef = useRef<FlowSnapshot>({ nodes: [], edges: [] });
  const dragStartSnapshotRef = useRef<FlowSnapshot | null>(null);
  const duplicateWarnAtRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    snapshotRef.current = { nodes, edges };
  }, [nodes, edges]);

  const warnDuplicateOutput = useCallback(() => {
    const now = Date.now();
    if (now - duplicateWarnAtRef.current < 800) return;
    duplicateWarnAtRef.current = now;

    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(DUPLICATE_OUTPUT_MESSAGE);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const isSameSnapshot = useCallback((a: FlowSnapshot, b: FlowSnapshot) => {
    return (
      JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
      JSON.stringify(a.edges) === JSON.stringify(b.edges)
    );
  }, []);

  const applySnapshotWithHistory = useCallback(
    (next: FlowSnapshot) => {
      const prev = snapshotRef.current;
      if (isSameSnapshot(prev, next)) return;

      setHistory((current) => ({
        past: [...current.past, prev],
        future: [],
      }));
      setNodes(next.nodes);
      setEdges(next.edges);
    },
    [isSameSnapshot, setEdges, setNodes],
  );

  const updateNodeData = useCallback(
    (
      nodeId: string,
      patch: Partial<
        Pick<
          IsolationNodeData,
          "title" | "action" | "question" | "branchMode" | "customBranchOptions"
        >
      >,
    ) => {
      const present = snapshotRef.current;
      const nextNodes = present.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node,
      );
      applySnapshotWithHistory({
        nodes: nextNodes,
        edges: present.edges,
      });
    },
    [applySnapshotWithHistory],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const present = snapshotRef.current;
      applySnapshotWithHistory({
        nodes: present.nodes.filter((node) => node.id !== nodeId),
        edges: present.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      });
    },
    [applySnapshotWithHistory],
  );

  const copyNode = useCallback(
    (nodeId: string) => {
      const present = snapshotRef.current;
      const source = present.nodes.find((node) => node.id === nodeId);
      if (!source) return;

      const copiedNode: Node<IsolationNodeData> = {
        ...source,
        id: genId(),
        position: {
          x: source.position.x + 36,
          y: source.position.y + 36,
        },
      };

      applySnapshotWithHistory({
        nodes: [...present.nodes, copiedNode],
        edges: present.edges,
      });
    },
    [applySnapshotWithHistory],
  );

  const attachNodeHandlers = useCallback(
    (rawNodes: Node<IsolationNodeData>[]): Node<IsolationNodeData>[] =>
      rawNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onCopy: copyNode,
          onDelete: deleteNode,
          onChange: updateNodeData,
        },
      })),
    [copyNode, deleteNode, updateNodeData],
  );

  useEffect(() => {
    if (initialLoadedRef.current) return;
    const key = procedureKeyRef.current;
    if (!key) return;

    const payload = readIsolationFlowPayload(key);
    if (!payload) return;

    initialLoadedRef.current = true;

    const flowNodes: Node<IsolationNodeData>[] = payload.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        title: n.data.title,
        action: n.data.action,
        question: n.data.question,
        branchMode: n.data.branchMode,
        customBranchOptions: n.data.customBranchOptions,
      },
    }));

    setNodes(attachNodeHandlers(flowNodes));
    setEdges(
      payload.edges.map((e) => ({
        ...e,
        type: "bezier" as const,
      })),
    );
    setHistory({ past: [], future: [] });
  }, [attachNodeHandlers, setEdges, setNodes]);

  const handleSave = useCallback(() => {
    const key = procedureKeyRef.current;
    if (!key) {
      window.close();
      return;
    }

    const payload = payloadFromFlowSnapshot(
      key,
      snapshotRef.current.nodes,
      snapshotRef.current.edges,
    );

    const channel = new BroadcastChannel(ISOLATION_FLOW_CHANNEL);
    channel.postMessage({ type: "SAVE", payload });
    channel.close();
    window.close();
  }, []);

  const createNode = useCallback(
    (
      type: IsolationNodeType,
      position: { x: number; y: number },
    ): Node<IsolationNodeData> => {
      const isStep = type === "isolationStep";
      return {
        id: genId(),
        type,
        position,
        data: {
          title: isStep ? "隔离步骤" : "流程结束",
          action: "",
          question: isStep ? "" : undefined,
          branchMode: isStep ? "是否分支" : undefined,
          customBranchOptions: isStep ? [""] : undefined,
          onCopy: copyNode,
          onDelete: deleteNode,
          onChange: updateNodeData,
        },
      };
    },
    [copyNode, deleteNode, updateNodeData],
  );

  const addNodeAtCenter = useCallback(
    (type: IsolationNodeType) => {
      const rf = rfRef.current;
      const wrap = wrapperRef.current;
      if (!rf || !wrap) return;

      const bounds = wrap.getBoundingClientRect();
      const centerInPane = { x: bounds.width / 2, y: bounds.height / 2 };
      const flowPos = rf.project(centerInPane);

      const present = snapshotRef.current;
      applySnapshotWithHistory({
        nodes: [...present.nodes, createNode(type, flowPos)],
        edges: present.edges,
      });
    },
    [applySnapshotWithHistory, createNode],
  );

  const onDragStartLibraryItem = useCallback(
    (e: React.DragEvent<HTMLDivElement>, type: IsolationNodeType) => {
      e.dataTransfer.setData(DRAG_MIME, type);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const onDragOverPane = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDropPane = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const type = e.dataTransfer.getData(DRAG_MIME) as IsolationNodeType;
      if (!type) return;

      const rf = rfRef.current;
      const wrap = wrapperRef.current;
      if (!rf || !wrap) return;

      const bounds = wrap.getBoundingClientRect();
      const position = rf.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const present = snapshotRef.current;
      applySnapshotWithHistory({
        nodes: [...present.nodes, createNode(type, position)],
        edges: present.edges,
      });
    },
    [applySnapshotWithHistory, createNode],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = snapshotRef.current.nodes.find(
        (node) => node.id === connection.source,
      );
      const targetNode = snapshotRef.current.nodes.find(
        (node) => node.id === connection.target,
      );
      if (!sourceNode || !targetNode) return false;

      if (sourceNode.type !== "isolationStep") return false;
      const targetTypeValid =
        targetNode.type === "isolationStep" ||
        targetNode.type === "isolationEnd";
      if (!targetTypeValid) return false;

      if (isOutputHandleAlreadyUsed(snapshotRef.current.edges, connection)) {
        warnDuplicateOutput();
        return false;
      }

      return true;
    },
    [warnDuplicateOutput],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;

      const present = snapshotRef.current;
      if (isOutputHandleAlreadyUsed(present.edges, connection)) {
        warnDuplicateOutput();
        return;
      }

      const nextEdges = addEdge(
        {
          ...connection,
          id: genId(),
          type: "bezier",
        },
        present.edges,
      );

      applySnapshotWithHistory({
        nodes: present.nodes,
        edges: nextEdges,
      });
    },
    [applySnapshotWithHistory, isValidConnection, warnDuplicateOutput],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
      const present = snapshotRef.current;
      applySnapshotWithHistory({
        nodes: present.nodes,
        edges: present.edges.filter((edge) => !deletedIds.has(edge.id)),
      });
    },
    [applySnapshotWithHistory],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;

      const prev = current.past[current.past.length - 1];
      const present = snapshotRef.current;
      setNodes(prev.nodes);
      setEdges(prev.edges);

      return {
        past: current.past.slice(0, -1),
        future: [present, ...current.future],
      };
    });
  }, [setEdges, setNodes]);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current;

      const next = current.future[0];
      const present = snapshotRef.current;
      setNodes(next.nodes);
      setEdges(next.edges);

      return {
        past: [...current.past, present],
        future: current.future.slice(1),
      };
    });
  }, [setEdges, setNodes]);

  const clearCanvas = useCallback(() => {
    applySnapshotWithHistory({ nodes: [], edges: [] });
  }, [applySnapshotWithHistory]);

  const onNodeDragStart = useCallback(() => {
    dragStartSnapshotRef.current = snapshotRef.current;
  }, []);

  const onNodeDragStop = useCallback(() => {
    const dragStartSnapshot = dragStartSnapshotRef.current;
    if (!dragStartSnapshot) return;

    const dragEndSnapshot = snapshotRef.current;
    if (isSameSnapshot(dragStartSnapshot, dragEndSnapshot)) return;

    setHistory((current) => ({
      past: [...current.past, dragStartSnapshot],
      future: [],
    }));
    dragStartSnapshotRef.current = null;
  }, [isSameSnapshot]);

  const handleToolbarClick = useCallback(
    (key: string) => {
      if (key === "undo") undo();
      if (key === "redo") redo();
      if (key === "clear") clearCanvas();
    },
    [clearCanvas, redo, undo],
  );

  const toolbarButtons = useMemo(
    () => [
      { key: "undo", icon: <Undo2 size={16} />, label: "撤销", info: true },
      { key: "redo", icon: <Redo2 size={16} />, label: "重做", info: true },
      {
        key: "clear",
        icon: <Trash2 size={16} />,
        label: "清空画布",
        danger: true,
      },
      {
        key: "check",
        icon: <CheckCircle2 size={16} />,
        label: "内容校验",
        success: true,
      },
    ],
    [],
  );

  return (
    <div className="ife-root">
      {toastMessage ? (
        <div className="ife-toast ife-toast--error" role="alert">
          <CircleX size={16} className="ife-toast__icon" aria-hidden />
          <span className="ife-toast__text">{toastMessage}</span>
        </div>
      ) : null}
      <header className="ife-topbar">
        <div className="ife-topbar-left">
          <h1 className="ife-title">隔离流程编排器</h1>
          <div className="ife-actions">
            {toolbarButtons.map((btn) => (
              <button
                key={btn.key}
                type="button"
                disabled={
                  (btn.key === "undo" && history.past.length === 0) ||
                  (btn.key === "redo" && history.future.length === 0)
                }
                onClick={() => handleToolbarClick(btn.key)}
                className={[
                  "ife-action-btn",
                  btn.info ? "is-info" : "",
                  btn.danger ? "is-danger" : "",
                  btn.success ? "is-success" : "",
                ].join(" ")}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="ife-save-btn" onClick={handleSave}>
          保存
        </button>
      </header>

      <div className="ife-main">
        <aside className="ife-sidebar">
          <div className="ife-sidebar-title">组件库</div>

          <div
            className="ife-library-card"
            draggable
            onDragStart={(e) => onDragStartLibraryItem(e, "isolationStep")}
            onClick={() => addNodeAtCenter("isolationStep")}
          >
            <div className="ife-library-card-title">
              <Shield size={16} color="#2563eb" />
              <span>隔离步骤</span>
            </div>
            <p className="ife-library-card-desc">包含动作和问题的处理节点</p>
          </div>

          <div
            className="ife-library-card"
            draggable
            onDragStart={(e) => onDragStartLibraryItem(e, "isolationEnd")}
            onClick={() => addNodeAtCenter("isolationEnd")}
          >
            <div className="ife-library-card-title">
              <Flag size={16} color="#dc2626" />
              <span>隔离结束</span>
            </div>
            <p className="ife-library-card-desc">流程的终止节点</p>
          </div>
        </aside>

        <section className="ife-canvas" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onInit={(instance) => {
              rfRef.current = instance;
              setViewportReady(true);
            }}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ type: "bezier" }}
            connectionLineType={ConnectionLineType.Bezier}
            connectionRadius={40}
            isValidConnection={isValidConnection}
            nodesConnectable
            deleteKeyCode={["Delete", "Backspace"]}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOverPane}
            onDrop={onDropPane}
            fitView={viewportReady}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} color="#e5e7eb" />
            <Controls />
          </ReactFlow>
        </section>
      </div>
    </div>
  );
}

export default function IsolationFlowEditor() {
  return (
    <ReactFlowProvider>
      <IsolationFlowEditorInner />
    </ReactFlowProvider>
  );
}
