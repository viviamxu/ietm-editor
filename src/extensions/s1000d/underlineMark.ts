import { Mark, mergeAttributes } from "@tiptap/core";

/** S1000D 下划线：`emphasis emphasisType="em03"`；与上划线 `em04`、删除线 `em05` 对称。 */
export const Underline = Mark.create({
  name: "underline",
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
          return raw === "em03" ? {} : false;
        },
      },
      { tag: "u" },
      {
        style: "text-decoration",
        consuming: false,
        getAttrs: (value) =>
          /underline/i.test(String(value)) ? {} : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "emphasis",
      mergeAttributes(HTMLAttributes, {
        class: "s1000d-emphasis s1000d-underline",
        "data-emphasis-type": "em03",
      }),
      0,
    ];
  },
});
