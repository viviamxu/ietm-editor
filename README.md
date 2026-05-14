# @ccengine/ietm-editor

S1000D IETM 编辑器 SDK：**React Island in Vanilla Shell** 架构。  
对外暴露纯 Vanilla JS 命令式 API，可在 Vue / React / 原生 HTML 等任意宿主中挂载，内部是完整的 React + Tiptap 运行环境。

发布到公司私服：`https://nexus.ccengine.com/repository/cc-npm/`

---

## 安装

项目根目录添加 `.npmrc`：

```ini
@ccengine:registry=https://nexus.ccengine.com/repository/cc-npm/
```

然后：

```bash
pnpm add @ccengine/ietm-editor
```

> 公司私服内任意机器都能直接装；如果是新机器，先 `npm login --registry=https://nexus.ccengine.com/repository/cc-npm/ --auth-type=legacy` 拿一次 token。

**离线分发**：在本仓库根目录执行 `pnpm pack`，将生成的 `.tgz` 发给对方，在其项目中执行 `pnpm add ./路径/包名-版本.tgz`（或 `package.json` 中 `file:` 依赖）。

---

## 使用

### 宿主容器高度（重要）

顶栏与格式工具栏使用 **`position: sticky`**：宿主页面整体滚动时仍会贴在视口顶部；在理想集成下（挂载节点有高度、滚动发生在 `.ietm-editor-pane` 内）则仍由 flex 布局固定不参与文档滚动。底部状态栏在壳内单独一行。文档过长时的主滚动条在主编辑区（右侧属性面板正文区在表单过长时内部滚动）。

请将 `createIETMEditor({ element })` 的挂载节点放在**有明确高度上限**的容器里，例如外层 `display: flex; flex-direction: column` 且挂载节点 `flex: 1; min-height: 0`，或 `height: 100%` / `height: 100vh`。若挂载节点随内容无限增高，浏览器会改为整页滚动，壳内固定布局可能表现异常。

### Vue 3（推荐：先注入宿主 schema，再挂载；空 DM 自动最小稿）

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import type { DescriptionSchema } from "@ccengine/ietm-editor";
import {
  createIETMEditor,
  type IETMEditorInstance,
  setDescriptionSchema,
} from "@ccengine/ietm-editor";
import "@ccengine/ietm-editor/style.css";

const containerEl = ref<HTMLElement | null>(null);
let instance: IETMEditorInstance | null = null;

onMounted(async () => {
  if (!containerEl.value) return;

  const schemaRes = await fetch("/api/description-schema.json");
  const hostSchema = (await schemaRes.json()) as DescriptionSchema;
  setDescriptionSchema(hostSchema);

  const xmlRes = await fetch("/api/dm-xml");
  const xml = xmlRes.ok ? await xmlRes.text() : "";

  instance = createIETMEditor({
    element: containerEl.value,
    descriptionSchema: hostSchema,
    ...(xml ? { dmXml: xml } : {}),
  });

  instance.on("update", ({ json }) => console.log("changed", json));
});

onBeforeUnmount(() => instance?.destroy());
</script>

<template>
  <div
    ref="containerEl"
    style="flex: 1; min-height: 0; display: flex; flex-direction: column"
  />
</template>
```

说明：`dmXml` 缺失或 `<content>` 为空时，不会再去展示旧版占位句；正文由 **`buildEmptyDescriptionDocJson(hostSchema)`** 在初始化阶段写入。若接口顺序必须是「先挂载、后拿 schema」，则在拿到 schema 后调用 **`setDescriptionSchema`** + **`instance.fillEmptyContentFromSchema()`**（须在 **`ready`** 之后）。

<details>
<summary>备选：手写首屏 JSON（一般不必需）</summary>

```ts
import type { JSONContent } from "@tiptap/core";
const emptyS1000dDoc: JSONContent = {
  type: "doc",
  content: [{ type: "para", content: [] }],
};
createIETMEditor({ element: el, content: emptyS1000dDoc });
```

</details>

若创建时手里已有整段 DM XML（含 `<dmodule>`），也可直接：

```ts
createIETMEditor({ element: el, dmXml: xmlString, descriptionSchema: hostSchema });
```

`dmXml` 与 `content` 同时传入时，**优先使用 `dmXml`**；DM 中无正文时再使用 **`content`**；二者皆无时按 schema 插入最小合法稿。

### 原生 HTML

```html
<!-- 示例：给挂载节点高度上限，壳内才会出现编辑区滚动条 -->
<div
  id="editor"
  style="height: 100vh; min-height: 0; display: flex; flex-direction: column"
></div>
<script type="module">
  import { createIETMEditor } from "@ccengine/ietm-editor";
  import "@ccengine/ietm-editor/style.css";

  const instance = createIETMEditor({
    element: document.getElementById("editor"),
  });
  window.addEventListener("beforeunload", () => instance.destroy());
</script>
```

---

## 正文与 DM XML（宿主必读）

SDK **不会**在包内写死示例 DM；**当前版本已移除**早期「未提供有效正文，请 loadDmXml…」类占位文案。  
当 **未显式传入 `content`**、且 **DM 中无可导入的 `<description>` 正文** 时，编辑器会按 **`descriptionSchema ?? getDescriptionSchema()`** 自动生成 **最小合法 S1000D 正文**（由 `buildEmptyDescriptionDocJson` 实现，规则粗粒度对应 schema 里 `description.content` 等字段）。

### 宿主使用自有 schema 文件（推荐流程）

宿主自带的约束文件须为 **JSON**，且与内置 **`描述类Schema.json` 同形**（`Record<string, { content?: string; group?: string }>`），类型即包导出的 **`DescriptionSchema`**。

1. **在创建编辑器之前**把该 JSON 写入 SDK（二选一，效果等价；可与 `createIETMEditor` 同时使用）  
   - **`setDescriptionSchema(hostSchema)`**，或  
   - **`createIETMEditor({ ..., descriptionSchema: hostSchema })`**（卸载实例时若曾传入会恢复内置默认，见 store 行为）。
2. **不要依赖「仅内置默认 schema」**又去抱怨最小稿不符合业务：内置默认仅为未配置时的回退；**业务 schema 必须由宿主注入**。
3. **整段 DM 的 `<content>` 为空 / 无 `<description>` / description 无子节点** 时：  
   - 若创建时传了 **`dmXml`** 且未另传 **`content`** → 初始正文会直接按 **当前** schema 生成最小稿（见 `resolveInitialEditorContent`）。  
   - 运行时 **`instance.loadDmXml(xml)`** 在同样情况下也会 **自动按当前 `getDescriptionSchema()`** 写入最小稿（与 `fillEmptyContentFromSchema` 一致）。
4. **schema 与 DM 均为接口异步返回**时，建议顺序：  
   - 先 **`await` 拿到 schema** → **`setDescriptionSchema(schema)`**（或把 `descriptionSchema` 放进 **`createIETMEditor`**），再 **`createIETMEditor`**；  
   - 若必须先挂载编辑器、后拉到 schema：在 **`ready`** 之后依次 **`setDescriptionSchema(schema)`** → **`instance.fillEmptyContentFromSchema()`**，再按需 **`loadDmXml`**。

### 1. 干净的首屏（推荐）

- **不传** `content`、**不传** `dmXml`：编辑器会按当前 **`getDescriptionSchema()`**（默认与 `描述类Schema.json` 一致，除非宿主已 `setDescriptionSchema`）插入 **最小合法 S1000D 正文**（例如空 `para`）。
- 若需**业务侧** schema，请务必 **`setDescriptionSchema(宿主 schema)`** 或 **`createIETMEditor({ descriptionSchema })`**（见上一小节）。
- 若希望**完全自定义**首屏 JSON，仍可显式传入 `content`：

  ```ts
  const emptyS1000dDoc = {
    type: "doc",
    content: [{ type: "para", content: [] }],
  };
  createIETMEditor({ element: el, content: emptyS1000dDoc });
  ```

### 2. 创建时带入整段 DM XML

`dmXml` 为**完整数据模块 XML 字符串**（含 `<dmodule>`）。内部会抽取 `<content>` → `<description>` 子树并导入（同时会更新与 `identAndStatusSection` 相关的元数据逻辑）。**若 `<content>` 内无可导入的 description 正文**（空壳、无子节点等），且未同时传入 **`content`**，则按 **`descriptionSchema ?? getDescriptionSchema()`** 插入最小合法稿；若已传 **`content`** 则回退使用该字段。

### 3. 接口异步返回后再加载（常见）

在 **`ready` 事件之后**调用 `instance.loadDmXml(xmlString)`。若根句柄尚未就绪就调用，可能返回 `false`。

### 4. 仅拿到 description 内层片段时

若接口返回的是**已截好的 description 子节点 XML 串**（无 `<dmodule>` 外壳），不要用 `loadDmXml`；应使用 `instance.setContent(fragmentString)`，字符串会经与编辑器一致的预处理再解析。

### 5. 包内导出的解析工具（高级用法）

以下函数与内部导入路径一致，宿主可自行组合后再 `setContent`：

- `getDescriptionInnerXmlFromDmXml(xmlString): string | null` — 从整段 DM 中取出可喂给编辑器的 description 内层 XML 串；失败返回 `null`。
- `preprocessS1000dDescriptionHtmlFragment(fragment): string` — 将片段整理为浏览器 `text/html` 解析可接受的形态。

### 6. 正文为空时按 schema 补全（`fillEmptyContentFromSchema`）

**`loadDmXml`** 在整段 DM 中**抽不到可导入的 description 正文**时，会自动按当前 schema 写入最小合法稿（与 **`fillEmptyContentFromSchema`** 一致），一般不再需宿主分支处理。

若宿主仍需**强制**用当前 store 中的 schema 覆盖正文（例如忽略 XML、或自定义流程），可以：

1. 先把服务端下发的约束 JSON 交给 **`setDescriptionSchema(schema)`** 或 **`createIETMEditor({ descriptionSchema: schema })`**（与 `描述类Schema.json` 同形）。
2. 再任选其一：
   - **实例方法（推荐）**：`instance.fillEmptyContentFromSchema()` — 内部使用 **`getDescriptionSchema()`** 与当前编辑器，须在 **`ready` 之后**调用；未就绪时返回 `false`。
   - **已有 Editor 引用时**：`fillEmptyContentFromSchema(editor, schema)`（从包入口导出）。
   - **仅要 JSON、不写入编辑器**：`buildEmptyDescriptionDocJson(schema)` / `buildEmptyDescriptionBodyFromSchema(schema)`，再自行 `setContent`。

`clearContent(editor, schema)` 与 **`fillEmptyContentFromSchema(editor, schema)`** 行为等价（清空并按 schema 初始化）。

---

## API

### `createIETMEditor(options): IETMEditorInstance`

| Option              | 类型                                                        | 默认     | 说明                                                                           |
| ------------------- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `element`           | `HTMLElement`                                               | 必填     | 挂载容器                                                                       |
| `content`           | `JSONContent` 或 `string`                                   | 无       | 初始正文；与 `dmXml` 同传且无正文时作为回退；皆无则按 schema 最小稿 |
| `dmXml`             | `string`                                                    | 无       | 整段 DM XML；与 `content` 同时存在时**优先**本字段；无正文时按 schema 插入最小合法稿 |
| `editable`          | `boolean`                                                   | `true`   | 是否可编辑                                                                     |
| `descriptionSchema` | `DescriptionSchema`（与 `src/data/描述类Schema.json` 同形） | 内置默认 | 服务端下发的描述类规则；工具栏插入会据此校验。传入时卸载编辑器会恢复内置默认。 |

宿主也可在挂载前调用 `setDescriptionSchema(schema)`，或与 `createIETMEditor({ descriptionSchema })` 二选一。

### `IETMEditorInstance`

```ts
{
  setContent(content): void
  loadDmXml(dmXml: string): boolean   // 有正文则导入；无 description 正文时按 schema 填充；未就绪 false
  fillEmptyContentFromSchema(): boolean // 按 getDescriptionSchema() 写入最小合法正文；未就绪 false
  setEditable(value): void
  getJSON(): JSONContent
  focus(): void
  // 表格（均返回 boolean：成功为 true；未就绪或 Tiptap 拒绝则为 false）
  insertTable(options?: { rows?: number; cols?: number; withHeaderRow?: boolean }): boolean
  addTableRowBefore(): boolean
  addTableRowAfter(): boolean
  addTableColumnBefore(): boolean
  addTableColumnAfter(): boolean
  on(event, handler): () => void   // 返回 off 函数
  off(event, handler): void
  destroy(): void
}
```

事件：`update` / `selectionChange` / `ready`。

**表格说明**：`insertTable` 在**当前选区/光标**处插入新表。`addTableRow*` / `addTableColumn*` 依赖 Tiptap 表格命令：用户光标需处于**某个单元格内**，否则会返回 `false`。请在 `ready` 之后再调用上述方法；若在挂载瞬间调用，`insertTable` 等可能尚未绑定成功而返回 `false`。

另可从包入口使用：`fillEmptyContentFromSchema(editor, schema)`、`buildEmptyDescriptionDocJson(schema)`、`buildEmptyDescriptionBodyFromSchema(schema)`、`clearContent(editor, schema)`（需 `@tiptap/core` 的 `Editor` 类型）。

---

## 发布到公司 Nexus

### 一次性准备

```powershell
npm login --registry=https://nexus.ccengine.com/repository/cc-npm/ --auth-type=legacy
```

输入公司账号 / 密码 / 邮箱，token 会自动写入 `~/.npmrc`。

### 每次发布

```bash
pnpm release:patch       # 0.1.0 -> 0.1.1，自动 build + publish
pnpm release:minor       # 0.1.0 -> 0.2.0
pnpm release:major       # 0.1.0 -> 1.0.0
```

或手动两步：

```bash
pnpm version patch
pnpm publish             # prepublishOnly 钩子会自动 build
```

发布成功后到 Nexus 控制台 `cc-npm` 仓库可见 `@ccengine/ietm-editor`。

---

## 开发

```bash
pnpm dev          # 启动 demo dev server，验证 SDK
pnpm build        # 构建 SDK 产物到 dist/
pnpm lint         # 代码检查
```

---

## 许可证

UNLICENSED — 仅供 ccengine 内部使用。
