# 样式说明

- **`src/style.css`**：入口；**先** `@import` 各 partial，**再** `@tailwind`（否则 PostCSS 会丢弃 import，且报错）。
- **`src/styles/partials/`**：按区域拆分的原有 CSS（应用壳、工具栏、主栏、Tiptap 文档、S1000D 等）。
- **`tailwind.config.js`**：`content` 指向 `src/**/*`；**`preflight: false`**，避免与宿主页或 ProseMirror 默认样式冲突。

新增界面样式时，可优先在组件上使用 **Tailwind 工具类**；复杂选择器（如 `.ietm-editor-surface .tiptap …`）继续放在对应 partial 或使用 `@layer components` + `@apply`。
