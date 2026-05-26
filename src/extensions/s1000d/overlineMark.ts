import { Mark, mergeAttributes } from "@tiptap/core";

/** S1000D 上横线：`emphasis emphasisType="em04"`；编辑态与下划线 `em03` 对称。 */
export const Overline = Mark.create({
  name: "overline",
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
          return raw === "em04" ? {} : false;
        },
      },
      {
        style: "text-decoration",
        consuming: false,
        getAttrs: (value) =>
          /overline/i.test(String(value)) ? {} : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "emphasis",
      mergeAttributes(HTMLAttributes, {
        class: "s1000d-emphasis s1000d-overline",
        "data-emphasis-type": "em04",
      }),
      0,
    ];
  },
});
