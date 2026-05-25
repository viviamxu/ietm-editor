/** 将宿主传入的 DM 文档名规范为顶栏展示文本（去掉路径与 `.xml` 后缀）。 */
export function normalizeDmDocumentName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").trim();
  if (!base) return "";
  return base.replace(/\.xml$/i, "") || base;
}
