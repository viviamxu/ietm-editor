import { useEffect, useRef } from "react";

import "./App.css";

import {
  createIETMEditor,
  getDescriptionSchema,
  type DescriptionSchema,
  type IETMEditorInstance,
} from "./index";

import bikeDmSampleXml from "./data/bikeDmSample.xml?raw";

// import faultDmXml from "./data/故障类.XML?raw";

import faultIsolationSchema from "./data/描述类Schema.json";

// import faultIsolationSchema from "./data/故障隔离.json";

import { getDmContentKind } from "./lib/s1000d/dmContentKind";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  const instanceRef = useRef<IETMEditorInstance | null>(null);

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const instance = createIETMEditor({
      element: el,

      dmXml: bikeDmSampleXml,

      dmDocumentName: "bikeDmSample.xml",

      // dmXml: faultDmXml,

      // dmDocumentName: "故障类.XML",

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
    });

    return () => {
      offUpdate();

      offReady();

      instance.destroy();

      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
  }, []);

  return (
    <main className="ietm-demo-shell">
      <div ref={containerRef} className="ietm-demo-mount" />
    </main>
  );
}

export default App;
