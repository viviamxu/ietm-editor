import { useCallback, useEffect, useRef } from "react";
import "./App.css";
import {
  createIETMEditor,
  getDescriptionSchema,
  type DescriptionSchema,
  type IETMEditorInstance,
} from "./index";
// import bikeDmSampleXml from "./data/bikeDmSample.xml?raw";
import faultDmXml from "./data/故障类.XML?raw";
// import faultIsolationSchema from "./data/描述类Schema.json";
import faultIsolationSchema from "./data/故障隔离.json";
import IsolationFlowEditor from "./components/IsolationFlowEditor";
import { getDmContentKind } from "./lib/s1000d/dmContentKind";
import {
  ISOLATION_FLOW_CHANNEL,
  type IsolationFlowMessage,
  type IsolationFlowPayload,
} from "./lib/s1000d/isolationFlowBridge";

function App() {
  const isFlowEditorPage = window.location.pathname === "/isolation-flow-editor";

  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<IETMEditorInstance | null>(null);
  const pendingFlowSaveRef = useRef<IsolationFlowPayload | null>(null);

  const applyPendingFlowSave = useCallback(() => {
    const pending = pendingFlowSaveRef.current;
    if (!pending || !instanceRef.current) return;
    if (instanceRef.current.applyIsolationFlow(pending)) {
      pendingFlowSaveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isFlowEditorPage) return;

    const channel = new BroadcastChannel(ISOLATION_FLOW_CHANNEL);
    channel.onmessage = (ev: MessageEvent<IsolationFlowMessage>) => {
      if (ev.data?.type !== "SAVE") return;
      const payload = ev.data.payload;
      if (instanceRef.current?.applyIsolationFlow(payload)) {
        pendingFlowSaveRef.current = null;
      } else {
        pendingFlowSaveRef.current = payload;
      }
    };

    return () => {
      channel.close();
    };
  }, [isFlowEditorPage]);

  useEffect(() => {
    if (isFlowEditorPage) return;

    const el = containerRef.current;
    if (!el) return;

    const instance = createIETMEditor({
      element: el,
      // dmXml: bikeDmSampleXml,
      // dmDocumentName: "bikeDmSample.xml",
      dmXml: faultDmXml,
      dmDocumentName: "故障类.XML",
      descriptionSchema: faultIsolationSchema as DescriptionSchema,
    });
    instanceRef.current = instance;

    const offUpdate = instance.on("update", ({ json }) => {
      // 演示 update 事件：打印根节点子项数量
      console.debug("[ietm] update, blocks:", json.content?.length ?? 0);
    });
    const offReady = instance.on("ready", () => {
      const schema = getDescriptionSchema();
      const kind = getDmContentKind(schema);
      console.log("[ietm] DM content kind:", kind);
      console.log("[ietm] fault mode:", kind === "faultIsolation");
      console.log("[ietm] content rule:", schema.content?.content);
      applyPendingFlowSave();
    });

    return () => {
      offUpdate();
      offReady();
      instance.destroy();
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
  }, [applyPendingFlowSave, isFlowEditorPage]);

  if (isFlowEditorPage) {
    return <IsolationFlowEditor />;
  }

  return (
    <main className="ietm-demo-shell">
      <div ref={containerRef} className="ietm-demo-mount" />
    </main>
  );
}

export default App;
