/** 宿主接管「预览」时提供的上下文 */
export interface OpenDmPdfPreviewContext {
  /** 导出当前编辑器的完整 DM XML 字符串 */
  exportDmXml: () => string;
}

/**
 * 底栏「预览」一站式回调：由宿主用当前编辑器内容请求预览，不强制先保存。
 * 返回可在 iframe 中使用的 PDF URL，或 PDF Blob。
 */
export type OpenDmPdfPreviewHandler = (
  ctx: OpenDmPdfPreviewContext,
) => Promise<string | Blob>;
