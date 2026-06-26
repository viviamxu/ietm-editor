import { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";

import type { Editor } from "@tiptap/core";

import {
  createIETMEditor,
  getDescriptionSchema,
  type DescriptionSchema,
  type IETMEditorInstance,
  type IETMResolvedTheme,
} from "./index";
import bikeDmSampleXml from "./data/描述类.xml?raw";
import bikeSchema from "./data/描述类Schema.json";

// import faultDmXml from "./data/故障类.XML?raw";
import ipdDmXml from "./data/图解demo.XML?raw";
import ipdSchema from "./data/图解类.json";
import procedureSchema from "./data/程序类.json";
import procedureDmXml from "./data/程序类.xml?raw";
import crewSchema from "./data/操作类.json";
import crewDmXml from "./data/操作类.XML?raw";

import { getDmContentKind } from "./lib/s1000d/dmContentKind";

/** 本地 Demo：在 .env 中设置 VITE_API_BASE_URL 后走内置 PDF 预览 GET；未设置则在预览面板提示配置方式 */
const demoApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  const instanceRef = useRef<IETMEditorInstance | null>(null);

  const [resolvedTheme, setResolvedTheme] = useState<IETMResolvedTheme>("light");

  const toggleHostTheme = useCallback(() => {
    const next =
      document.body.getAttribute("arco-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("arco-theme", next);
  }, []);

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const instance = createIETMEditor({
      element: el,

      dmXml: ipdDmXml,

      dmDocumentName: "操作类.XML",

      theme: "auto",
      onThemeChange: setResolvedTheme,

      descriptionSchema: ipdSchema as DescriptionSchema,
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

    let offDevReady: (() => void) | undefined;
    if (import.meta.env.DEV) {
      const win = window as Window & {
        __editor?: IETMEditorInstance;
        __tiptapEditor?: Editor | null;
      };
      win.__editor = instance;
      offDevReady = instance.on("ready", () => {
        win.__tiptapEditor = instance.getEditor();
      });
    }

    setResolvedTheme(instance.getTheme());
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

      offDevReady?.();

      if (import.meta.env.DEV) {
        const win = window as Window & {
          __editor?: IETMEditorInstance;
          __tiptapEditor?: Editor | null;
        };
        if (win.__editor === instance) {
          win.__editor = undefined;
        }
        win.__tiptapEditor = undefined;
      }

      instance.destroy();

      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
  }, []);

  return (
    <main className="ietm-demo-shell">
      {/* <header className="ietm-demo-toolbar">
        <span className="ietm-demo-toolbar__label">
          主题（auto）：{resolvedTheme}
        </span>
        <button
          type="button"
          className="ietm-demo-toolbar__btn"
          onClick={toggleHostTheme}
        >
          切换主题
        </button>
      </header> */}
      <div ref={containerRef} className="ietm-demo-mount" />
    </main>
  );
}
export default App;
