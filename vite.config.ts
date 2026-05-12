import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitePluginForArco } from "@arco-plugins/vite-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vitePluginForArco({
      style: true, // 如果你想让它编译出纯 CSS；填 true 会引入 less
      modifyVars: {
        // 核心：在编译阶段将 Arco 的默认前缀替换为我们的隔离前缀
        prefix: "ietm-arco",
      },
    }),
  ],
  server: {
    host: "0.0.0.0", // 监听所有地址，包括局域网和本地
    port: 5173, // 确认端口号
  },
});
