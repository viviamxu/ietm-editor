import { useEffect, useRef } from "react";

import "./App.css";

import {
  createIETMEditor,
  getDescriptionSchema,
  type DescriptionSchema,
  type IETMEditorInstance,
} from "./index";

// import bikeDmSampleXml from "./data/描述类.xml?raw";

// import faultDmXml from "./data/故障类.XML?raw";
import procedureDmXml from "./data/程序类.xml?raw";

// import faultIsolationSchema from "./data/描述类Schema.json";

// import faultIsolationSchema from "./data/故障隔离.json";
import procedureSchema from "./data/程序类.json";
import demoDerivativeBindingTree from "./data/derivativeBindingTree.json";

import { getDmContentKind } from "./lib/s1000d/dmContentKind";
import type { DerivativeBindingTreeNode } from "./types/procedureAnimationBinding";

/** 本地 Demo：在 .env 中设置 VITE_API_BASE_URL 后走内置 PDF 预览 GET；未设置则在预览面板提示配置方式 */
const demoApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  const instanceRef = useRef<IETMEditorInstance | null>(null);

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const instance = createIETMEditor({
      element: el,

      dmXml: procedureDmXml,

      dmDocumentName: "procedureDm.xml",

      // dmXml: faultDmXml,

      // dmDocumentName: "故障类.XML",

      descriptionSchema: procedureSchema as DescriptionSchema,
      onFetchDerivativeBindingTree: async () =>
        demoDerivativeBindingTree as DerivativeBindingTreeNode[],
      ...(demoApiBaseUrl
        ? { apiBaseUrl: demoApiBaseUrl }
        : {
            onOpenDmPdfPreview: async () => {
              throw new Error(
                "本地 Demo 未配置预览后端：复制 .env.example 为 .env，设置 VITE_API_BASE_URL=你的后端地址，重启 pnpm dev。生产环境由宿主传入 apiBaseUrl 或 onOpenDmPdfPreview。",
              );
            },
          }),
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
