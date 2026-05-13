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

---

## 使用

### 宿主容器高度（重要）

顶栏与格式工具栏使用 **`position: sticky`**：宿主页面整体滚动时仍会贴在视口顶部；在理想集成下（挂载节点有高度、滚动发生在 `.ietm-editor-pane` 内）则仍由 flex 布局固定不参与文档滚动。底部状态栏在壳内单独一行。文档过长时的主滚动条在主编辑区（右侧属性面板正文区在表单过长时内部滚动）。

请将 `createIETMEditor({ element })` 的挂载节点放在**有明确高度上限**的容器里，例如外层 `display: flex; flex-direction: column` 且挂载节点 `flex: 1; min-height: 0`，或 `height: 100%` / `height: 100vh`。若挂载节点随内容无限增高，浏览器会改为整页滚动，壳内固定布局可能表现异常。

### Vue 3

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { createIETMEditor, type IETMEditorInstance } from '@ccengine/ietm-editor'
import '@ccengine/ietm-editor/style.css'

const containerEl = ref<HTMLElement | null>(null)
const platform = ref<'A320' | 'B737' | 'C919'>('A320')
const showOnlyApplicable = ref(false)
let instance: IETMEditorInstance | null = null

onMounted(() => {
  if (!containerEl.value) return
  instance = createIETMEditor({
    element: containerEl.value,
    applicability: {
      activePlatform: platform.value,
      showOnlyApplicable: showOnlyApplicable.value,
    },
  })
  instance.on('update', ({ json }) => console.log('changed', json))
  instance.on('ready', () => {
    // 表格 API 需在编辑器就绪后调用；光标须在表格单元格内时增行/增列才会成功
    // instance.insertTable({ rows: 4, cols: 5, withHeaderRow: true })
    // instance.addTableRowAfter()
  })
})

watch([platform, showOnlyApplicable], () => {
  instance?.setApplicability({
    activePlatform: platform.value,
    showOnlyApplicable: showOnlyApplicable.value,
  })
})

onBeforeUnmount(() => instance?.destroy())
</script>

<template>
  <!-- 示例：占满父级可用高度；父级需为 flex 列且自身有高度 -->
  <div ref="containerEl" style="flex: 1; min-height: 0; display: flex; flex-direction: column" />
</template>
```

### 原生 HTML

```html
<!-- 示例：给挂载节点高度上限，壳内才会出现编辑区滚动条 -->
<div id="editor" style="height: 100vh; min-height: 0; display: flex; flex-direction: column"></div>
<script type="module">
  import { createIETMEditor } from '@ccengine/ietm-editor'
  import '@ccengine/ietm-editor/style.css'

  const instance = createIETMEditor({
    element: document.getElementById('editor'),
  })
  window.addEventListener('beforeunload', () => instance.destroy())
</script>
```

---

## API

### `createIETMEditor(options): IETMEditorInstance`


| Option          | 类型                                       | 默认                | 说明      |
| --------------- | ---------------------------------------- | ----------------- | ------- |
| `element`       | `HTMLElement`                            | 必填                | 挂载容器    |
| `content`       | `JSONContent | string`                   | 内置示例              | 初始文档内容  |
| `applicability` | `{ activePlatform, showOnlyApplicable }` | `{ A320, false }` | 适用性全局配置 |
| `editable`      | `boolean`                                | `true`            | 是否可编辑   |
| `descriptionSchema` | `DescriptionSchema`（与 `src/data/描述类Schema.json` 同形） | 内置默认 | 服务端下发的描述类规则；工具栏插入会据此校验。传入时卸载编辑器会恢复内置默认。 |

宿主也可在挂载前调用 `setDescriptionSchema(schema)`，或与 `createIETMEditor({ descriptionSchema })` 二选一。

### `IETMEditorInstance`

```ts
{
  setContent(content): void
  setApplicability(next): void
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