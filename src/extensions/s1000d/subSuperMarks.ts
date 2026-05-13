import { Mark, mergeAttributes } from "@tiptap/core";

/** 与样例 XML `<subScript>` / `<superScript>` 对应；导入时 HTML 多为小写 `subscript`/`superscript`。 */
export const S1000DSub = Mark.create({
  name: "s1000dSub",
  inclusive: true,
  excludes: "s1000dSup",

  parseHTML() {
    return [{ tag: "sub" }, { tag: "subscript" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sub", mergeAttributes(HTMLAttributes), 0];
  },
  //快捷键：Ctrl+= 切换下标
  addKeyboardShortcuts() {
    return {
      "Mod-=": () =>
        this.editor
          .chain()
          .focus()
          .unsetMark("s1000dSup")
          .toggleMark("s1000dSub")
          .run(),
    };
  },
});

export const S1000DSup = Mark.create({
  name: "s1000dSup",
  inclusive: true,
  excludes: "s1000dSub",

  parseHTML() {
    return [{ tag: "sup" }, { tag: "superscript" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes), 0];
  },

  //快捷键：Ctrl+Shift+= 切换上标
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-=": () =>
        this.editor
          .chain()
          .focus()
          .unsetMark("s1000dSub")
          .toggleMark("s1000dSup")
          .run(),
    };
  },
});
