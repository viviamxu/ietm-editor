import type { Editor } from "@tiptap/core";

import { exportEditorToDmXmlString } from "../s1000d/descriptionSchemaInsert";
import type { OpenDmPdfPreviewHandler } from "../../types/dmPdfPreviewHandler";
import type { SaveDmXmlHandler } from "../../types/saveDmXmlHandler";

/** DM PDF 预览接口默认路径（相对 {@link DmPdfPreviewOptions.apiBaseUrl} 或站点根）。 */
export const DEFAULT_DM_PDF_PREVIEW_PATH =
  "/czy-ietm-admin/ietm/preview/dm/pdf";

export interface DmPdfPreviewOptions {
  editor: Editor;
  /**
   * 优先：宿主一站式预览；配置后忽略 {@link apiBaseUrl}、{@link fetchDmPdfPreview} 等内置请求。
   */
  onOpenDmPdfPreview?: OpenDmPdfPreviewHandler;
  onSaveDmXml?: SaveDmXmlHandler;
  /** 如 `https://api.example.com` 或空字符串表示与页面同源 */
  apiBaseUrl?: string;
  dmPdfPreviewPath?: string;
  /** 自定义预览请求（不强制先保存） */
  fetchDmPdfPreview?: () => Promise<string | Blob>;
  fetchInit?: RequestInit;
}

async function assertPdfBlob(blob: Blob): Promise<void> {
  const head = await blob.slice(0, 5).text();
  if (head.startsWith("%PDF") || blob.type.toLowerCase().includes("pdf")) {
    return;
  }
  const sniff = await blob.slice(0, 256).text();
  if (
    sniff.trimStart().startsWith("<!") ||
    /<html[\s>]/i.test(sniff) ||
    sniff.includes("/@react-refresh") ||
    sniff.includes("/@vite/")
  ) {
    throw new Error(
      "预览接口返回了 HTML 页面而非 PDF。请配置 onOpenDmPdfPreview、fetchDmPdfPreview，或检查 apiBaseUrl 是否指向后端服务。",
    );
  }
  throw new Error("预览接口返回的不是 PDF 文件");
}

export async function pdfPreviewResultToUrl(
  result: string | Blob,
): Promise<{ url: string; revokeOnClose: boolean }> {
  if (typeof result === "string") {
    return { url: result, revokeOnClose: false };
  }
  await assertPdfBlob(result);
  return { url: URL.createObjectURL(result), revokeOnClose: true };
}

export function resolveDmPdfPreviewUrl(
  apiBaseUrl = "",
  path = DEFAULT_DM_PDF_PREVIEW_PATH,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl.replace(/\/$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export async function saveDmXmlFromEditor(
  editor: Editor,
  onSaveDmXml?: SaveDmXmlHandler,
): Promise<void> {
  if (!onSaveDmXml) {
    throw new Error("未配置 onSaveDmXml，无法保存后预览");
  }
  await Promise.resolve(onSaveDmXml(exportEditorToDmXmlString(editor)));
}

function pickPdfUrlFromJson(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.url === "string" && record.url) return record.url;
  if (typeof record.data === "string" && record.data) return record.data;
  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (typeof data.url === "string" && data.url) return data.url;
  }
  return null;
}

export async function fetchDmPdfPreviewUrl(options: {
  apiBaseUrl?: string;
  path?: string;
  fetchInit?: RequestInit;
}): Promise<{ url: string; revokeOnClose: boolean }> {
  const url = resolveDmPdfPreviewUrl(
    options.apiBaseUrl,
    options.path ?? DEFAULT_DM_PDF_PREVIEW_PATH,
  );

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    ...options.fetchInit,
  });

  if (!response.ok) {
    throw new Error(`PDF 预览失败（${response.status}）`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (
    contentType.includes("text/html") ||
    contentType.includes("text/javascript")
  ) {
    throw new Error(
      "预览接口返回了 HTML 页面而非 PDF（开发环境下常为 Vite 首页）。请配置 onOpenDmPdfPreview、fetchDmPdfPreview，或设置正确的 apiBaseUrl。",
    );
  }

  if (contentType.includes("application/json")) {
    const json: unknown = await response.json();
    const pdfUrl = pickPdfUrlFromJson(json);
    if (!pdfUrl) {
      throw new Error("PDF 预览接口返回格式无效");
    }
    return { url: pdfUrl, revokeOnClose: false };
  }

  const blob = await response.blob();
  await assertPdfBlob(blob);
  return { url: URL.createObjectURL(blob), revokeOnClose: true };
}

/**
 * 加载 PDF 预览：不强制先保存。
 * 若传入 {@link onOpenDmPdfPreview} 则由宿主用 {@link exportDmXml} 处理；
 * 否则走 {@link fetchDmPdfPreview} 或内置 GET 预览接口。
 */
export async function openDmPdfPreview(
  options: DmPdfPreviewOptions,
): Promise<{ url: string; revokeOnClose: boolean }> {
  if (options.onOpenDmPdfPreview) {
    const result = await options.onOpenDmPdfPreview({
      exportDmXml: () => exportEditorToDmXmlString(options.editor),
    });
    return pdfPreviewResultToUrl(result);
  }

  if (options.fetchDmPdfPreview) {
    return pdfPreviewResultToUrl(await options.fetchDmPdfPreview());
  }

  if (!options.apiBaseUrl?.trim()) {
    throw new Error(
      "未配置 PDF 预览：请在 createIETMEditor 中传入 onOpenDmPdfPreview、fetchDmPdfPreview 或 apiBaseUrl（后端 API 根路径）。",
    );
  }

  return fetchDmPdfPreviewUrl({
    apiBaseUrl: options.apiBaseUrl,
    path: options.dmPdfPreviewPath,
    fetchInit: options.fetchInit,
  });
}
