import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePluginForArco } from "@arco-plugins/vite-react";

// 库模式：把 React + Tiptap 等全部 bundle 进 SDK，
// 这样消费方（Vue / 原生 HTML / Angular 等）无需提供 React 运行时。
export default defineConfig({
  plugins: [
    react(),
    vitePluginForArco({
      style: "css", // 如果你想让它编译出纯 CSS；填 true 会引入 less
      modifyVars: {
        // 核心：在编译阶段将 Arco 的默认前缀替换为我们的隔离前缀
        prefix: "ietm-arco",
      },
    }),
  ],
  publicDir: false,
  build: {
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "IETMEditor",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "style.css";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
});
