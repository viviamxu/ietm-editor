import { Mark, mergeAttributes } from "@tiptap/core";

/** S1000D 删除线：`emphasis emphasisType="em05"`。 */
export const Strikethrough = Mark.create({
  name: "strikethrough",
  inclusive: true,

  parseHTML() {
    return [
      {
        tag: "emphasis",
        priority: 210,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false;
          const raw =
            el.getAttribute("emphasisType") ??
            el.getAttribute("emphasistype");
          return raw === "em05" ? {} : false;
        },
      },
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        style: "text-decoration",
        consuming: false,
        getAttrs: (value) =>
          /line-through/i.test(String(value)) ? {} : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "emphasis",
      mergeAttributes(HTMLAttributes, {
        class: "s1000d-emphasis s1000d-strikethrough",
        "data-emphasis-type": "em05",
      }),
      0,
    ];
  },
});
