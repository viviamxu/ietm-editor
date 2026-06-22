import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";

/** 与顶栏「文件 / 编辑 / 插入」选项卡一致 */
export type ToolbarTab = "file" | "edit" | "insert";

/** 图解类 fmft 插入意图（工具栏 vs NodeView 块内回填） */
export type FmftInsertIntent = "sibling" | "intoBlock";

export type ToolbarItemContext = {
  editor: Editor;
  editable: boolean;
  activeTabKey: ToolbarTab;
  /** 只读时为 `true`，与格式栏禁用逻辑一致 */
  formatBarLocked: boolean;
  /**
   * `sibling`：工具栏插入，在当前 figure/multimedia 后新增同级块（默认）。
   * `intoBlock`：figure/multimedia NodeView「选择图片」等，写入当前块内部。
   */
  fmftInsertIntent?: FmftInsertIntent;
  /** `intoBlock` 时目标块在文档中的位置 */
  fmftBlockPos?: number;
  /** `intoBlock` 时目标块类型 */
  fmftBlockType?: "figure" | "multimedia";
};

/** 格式工具栏内置按钮 id（用于 `hideBuiltinItems`） */
export type BuiltinToolbarItemId =
  /** 可编辑态：锁定为只读 */
  | "lockReadonly"
  /** 只读态：铅笔一键进入编辑（同步切状态；异步检出请隐藏此项并用 `placement: "editToggle"` 自定义按钮 + `setEditable`） */
  | "editMode"
  | "undo"
  | "redo"
  | "save"
  | "clearContent"
  | "insertLevelledPara"
  | "insertSequentialList"
  | "insertRandomList"
  | "insertTable"
  | "insertImage"
  | "insertFilm"
  | "insertSymbol"
  | "internalRef"
  | "insertExternalRef";

/**
 * 自定义按钮插入位置。
 * `editToggle`：与内置锁/铅笔同一簇（工具栏最左侧），适合「检出」等宿主接管编辑入口。
 */
export type ToolbarItemPlacement =
  | "editToggle"
  | "insert"
  | "format"
  | "reference";

export type CustomToolbarItem = {
  id: string;
  title: string;
  ariaLabel?: string;
  /** 仅在对应顶栏选项卡下显示；不传则始终显示 */
  tab?: ToolbarTab;
  /** 工具栏分组；默认 `insert`。`editToggle` 与锁/铅笔同簇（最左侧） */
  placement?: ToolbarItemPlacement;
  /** 组内排序，越小越靠前 */
  order?: number;
  icon?: ReactNode;
  disabled?: boolean | ((ctx: ToolbarItemContext) => boolean);
  hidden?: boolean | ((ctx: ToolbarItemContext) => boolean);
  onClick: (ctx: ToolbarItemContext) => void;
};

export type ToolbarConfig = {
  /** 追加自定义工具栏按钮 */
  customItems?: CustomToolbarItem[];
  /**
   * 隐藏指定内置按钮。
   * 异步检出典型配置：`hideBuiltinItems: ['editMode']` + `placement: 'editToggle'` 的自定义「检出」，
   * 成功后再 `instance.setEditable(true)`；可选同时隐藏 `lockReadonly` 改由宿主做检入。
   */
  hideBuiltinItems?: BuiltinToolbarItemId[];
  /**
   * 宿主接管「插入图片」点击（仍显示内置按钮，除非同时在 `hideBuiltinItems` 中含 `insertImage`）。
   * 未传时打开 SDK 内置出版物弹框。
   * `intoBlock` 时请根据 `ctx.fmftInsertIntent` 调用 `insertImages(..., { fmftInsertIntent: 'intoBlock' })`。
   */
  onInsertImageClick?: (ctx: ToolbarItemContext) => void;
  /**
   * 宿主接管「插入多媒体」点击。
   * 未传时与插入图片共用内置出版物弹框。
   * `intoBlock` 时编辑器已选中目标 `multimedia`，确认后调用 `insertMultimedia` 即可写入块内。
   */
  onInsertFilmClick?: (ctx: ToolbarItemContext) => void;
  /**
   * 宿主接管「插入外部引用」：打开 DM 选择弹框，确认后调用 `insertDmRefs` 写入编辑器。
   * 未传时打开 SDK 内置「引用出版物」弹框（mock 数据）。
   */
  onInsertExternalRefClick?: (ctx: ToolbarItemContext) => void;
  /**
   * 宿主接管外部引用「打开出版物」：在新窗口/新 Tab 加载对应 DM XML。
   * 未传时 SDK 仅演示提示。
   */
  onOpenExternalRefTarget?: (ctx: OpenExternalRefContext) => void | Promise<void>;
};

/** 点击外部引用箭头时传给宿主（用于打开另一份 DM）。 */
export type OpenExternalRefContext = {
  editor: Editor;
  rawXml: string;
  title: string;
  code: string;
  /** 宿主跳转用稳定 ID（如 dmInfoId）；导出/导入时写入 `<dmRef data-ref-target-id>` */
  refTargetId?: string | null;
  dmCode: Record<string, string>;
  issueInfo: { issueNumber: string; inWork: string };
  language: { languageIsoCode: string; countryIsoCode: string };
};

/** 宿主选中的 S1000D 外部引用（`dmRef`）片段。 */
export type InsertDmRefPayload = {
  /** 完整 `<dmRef>…</dmRef>` XML 字符串 */
  rawXml: string;
  /** Popover 等 UI 展示编码；导出时写入 `<dmRef data-display-code>` 并 round-trip */
  displayCode?: string | null;
  /** 宿主跳转用稳定 ID；导出时写入 `<dmRef data-ref-target-id>` 并 round-trip */
  refTargetId?: string | null;
};

export type InsertImagePayload = {
  src: string;
  alt?: string;
  figureId?: string;
  unitOfMeasure?: string;
};
