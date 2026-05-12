/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // 库嵌入宿主页面且含 ProseMirror：关闭 Preflight，避免与宿主/Tiptap 全局样式冲突
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
