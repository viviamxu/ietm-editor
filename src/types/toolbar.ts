import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";

/** 与顶栏「文件 / 编辑 / 插入」选项卡一致 */
export type ToolbarTab = "file" | "edit" | "insert";

export type ToolbarItemContext = {
  editor: Editor;
  editable: boolean;
  activeTabKey: ToolbarTab;
  /** 只读时为 `true`，与格式栏禁用逻辑一致 */
  formatBarLocked: boolean;
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
  | "internalRef";

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
   */
  onInsertImageClick?: (ctx: ToolbarItemContext) => void;
  /**
   * 宿主接管「插入多媒体」点击。
   * 未传时与插入图片共用内置出版物弹框。
   */
  onInsertFilmClick?: (ctx: ToolbarItemContext) => void;
};

export type InsertImagePayload = {
  src: string;
  alt?: string;
  figureId?: string;
  unitOfMeasure?: string;
};
