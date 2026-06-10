import { getFileUrlPrefix } from "../../store/fileUrlStore";

/** 是否为带 scheme 的绝对 URL（含 `data:` / `blob:`）。 */
export function isAbsoluteFileUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (/^([a-z][a-z0-9+.-]*:)/i.test(t)) return true;
  if (t.startsWith("//")) return true;
  return false;
}

function normalizePrefix(prefix: string): string {
  const p = prefix.trim();
  if (!p) return "";
  return p.endsWith("/") ? p : `${p}/`;
}

function normalizeRelativePath(relative: string): string {
  return relative.trim().replace(/^\/+/, "");
}

/**
 * 相对路径 + prefix → 完整 URL（插入、打开 XML、ICN 回填、渲染用）。
 * 已是绝对 URL 则原样返回。
 */
export function resolveFileUrl(
  path: string | null | undefined,
  prefix?: string,
): string {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  if (isAbsoluteFileUrl(raw)) return raw;

  const p = normalizePrefix(prefix ?? getFileUrlPrefix());
  if (!p) return raw;

  return `${p}${normalizeRelativePath(raw)}`;
}

/**
 * 完整 URL → 相对路径（XML 导出 `xlink:href` 用）。
 * 已是相对路径则规范化后返回；绝不写入绝对 URL。
 */
export function toRelativeFileUrl(
  path: string | null | undefined,
  prefix?: string,
): string {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  if (!isAbsoluteFileUrl(raw)) {
    return normalizeRelativePath(raw);
  }

  const p = normalizePrefix(prefix ?? getFileUrlPrefix());
  if (p && raw.startsWith(p)) {
    return normalizeRelativePath(raw.slice(p.length));
  }

  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") {
      const pathname = u.pathname.replace(/^\/+/, "");
      if (pathname) {
        return pathname + u.search + u.hash;
      }
    }
  } catch {
    /* ignore malformed URL */
  }

  return normalizeRelativePath(raw);
}
