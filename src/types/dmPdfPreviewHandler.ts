/** 宿主接管「预览」时提供的上下文 */
export interface OpenDmPdfPreviewContext {
  /** 导出当前编辑器的完整 DM XML 字符串 */
  exportDmXml: () => string;
}

/**
 * 底栏「预览」一站式回调：保存、请求预览接口、鉴权等均由宿主完成。
 * 返回可在 iframe 中使用的 PDF URL，或 PDF Blob。
 */
export type OpenDmPdfPreviewHandler = (
  ctx: OpenDmPdfPreviewContext,
) => Promise<string | Blob>;
