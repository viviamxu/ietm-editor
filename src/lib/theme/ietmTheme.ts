import type { IETMResolvedTheme, IETMThemeMode } from "../../types/ietmTheme";

const DATA_IETM_THEME = "data-ietm-theme";

/** 从 DOM 读取宿主主题 hint（`arco-theme` / `data-theme`）。 */
export function readDomThemeHint(
  mountEl?: HTMLElement | null,
): IETMResolvedTheme | null {
  const values: (string | null | undefined)[] = [
    mountEl?.closest("[arco-theme]")?.getAttribute("arco-theme"),
    mountEl?.getAttribute("arco-theme"),
    document.body.getAttribute("arco-theme"),
    document.documentElement.getAttribute("arco-theme"),
    document.documentElement.getAttribute("data-theme"),
  ];

  for (const value of values) {
    if (value === "dark") return "dark";
    if (value === "light") return "light";
  }
  return null;
}

/** 将 `theme` 配置解析为实际生效的 light / dark。 */
export function resolveIetmTheme(
  mode: IETMThemeMode,
  mountEl?: HTMLElement | null,
): IETMResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";

  const fromDom = readDomThemeHint(mountEl);
  if (fromDom) return fromDom;

  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

/** 在挂载根节点写入 `data-ietm-theme`（不污染 `body`）。 */
export function applyIetmThemeAttribute(
  root: HTMLElement | null,
  resolved: IETMResolvedTheme,
): void {
  if (!root) return;
  root.setAttribute(DATA_IETM_THEME, resolved);
}

export { DATA_IETM_THEME };
