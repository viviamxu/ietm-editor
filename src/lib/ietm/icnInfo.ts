/** ICN 接口默认路径 */
export const DEFAULT_ICN_INFO_PATH = "/czy-ietm-admin/ietm/icn/icnInfo";

/** 后端 `/icn/icnInfo` 单条数据结构 */
export interface IcnInfoRow {
  id: number;
  fullCode: string;
  title: string;
  /**
   * 业务类型：`"cc3d"` 三维 | `"math"` 公式 | `null` 其它。
   * 对应后端 `dataType` 字段。
   */
  dataType: string | null;
  /** 文件后缀名（如 `"jpg"` / `"zip"`），仅用于展示/校验 */
  fileType: string | null;
  /** 主文件路径：cc3d 时为 zip 包 URL，图片时为图片 URL */
  filePath: string;
  /** 配置文件路径（cc3d 场景配置） */
  cnfPath: string | null;
  /** 缩略图路径 */
  thPath: string | null;
  issueNumber: string;
  securityClassification: string;
}

/** 后端分页响应（包一层 `data`） */
interface IcnInfoResponse {
  code?: number;
  data?: {
    total?: number;
    list?: IcnInfoRow[];
    records?: IcnInfoRow[];
  };
}

export function resolveIcnInfoUrl(apiBaseUrl = "", path = DEFAULT_ICN_INFO_PATH): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl.replace(/\/$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export async function fetchIcnInfoList(options: {
  apiBaseUrl?: string;
  path?: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  fetchInit?: RequestInit;
}): Promise<{ list: IcnInfoRow[]; total: number }> {
  const url = resolveIcnInfoUrl(options.apiBaseUrl, options.path);
  const params = new URLSearchParams();
  if (options.page != null) params.set("page", String(options.page));
  if (options.pageSize != null) params.set("pageSize", String(options.pageSize));
  if (options.keyword) params.set("keyword", options.keyword);

  const fullUrl = params.toString() ? `${url}?${params}` : url;

  const response = await fetch(fullUrl, {
    method: "GET",
    credentials: "include",
    ...options.fetchInit,
  });

  if (!response.ok) {
    throw new Error(`ICN 信息接口失败（${response.status}）`);
  }

  const json: IcnInfoResponse = await response.json();
  const data = json.data ?? {};
  const list = data.list ?? data.records ?? [];
  const total = data.total ?? list.length;
  return { list, total };
}
