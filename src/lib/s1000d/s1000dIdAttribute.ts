/** S1000D 元素 `id`：写入 DOM 的 `id` 与 `data-s1000d-element-id`，供内部引用跳转闪烁等定位。 */
export function s1000dIdAttributeConfig() {
  return {
    default: null as string | null,
    parseHTML: (el: HTMLElement) =>
      el.getAttribute("id") ?? el.getAttribute("data-s1000d-element-id"),
    renderHTML: (attrs: { id?: string | null }) => {
      const raw = attrs.id;
      if (raw == null) return {};
      const id = String(raw).trim();
      if (!id) return {};
      return { id, "data-s1000d-element-id": id };
    },
  };
}
