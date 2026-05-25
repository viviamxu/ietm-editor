import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import {
  defaultIsolationEndTitle,
  defaultIsolationStepTitle,
  getTitleTextFromNode,
} from "./faultIsolationDefaultTitles";

export type IsolationStepRefOption = {
  id: string;
  label: string;
  kind: "step" | "end";
};

export { getTitleTextFromNode };

/** 收集同一 `isolationMainProcedure` 内可供「下一步」选择的步骤/结束块。 */
export function collectIsolationStepRefs(editor: Editor): IsolationStepRefOption[] {
  const { doc } = editor.state;
  const out: IsolationStepRefOption[] = [];

  doc.descendants((node) => {
    if (node.type.name !== "isolationMainProcedure") return;
    let stepIndex = 0;
    let endIndex = 0;
    node.forEach((child) => {
      const id = String(child.attrs.id ?? "").trim();
      if (!id) return;
      if (child.type.name === "isolationStep") {
        stepIndex += 1;
        let titleNode: PMNode | null = null;
        child.forEach((c) => {
          if (c.type.name === "title") titleNode = c;
        });
        const titleText = getTitleTextFromNode(titleNode);
        out.push({
          id,
          label: titleText || defaultIsolationStepTitle(stepIndex),
          kind: "step",
        });
      } else if (child.type.name === "isolationProcedureEnd") {
        let titleNode: PMNode | null = null;
        child.forEach((c) => {
          if (c.type.name === "title") titleNode = c;
        });
        const titleText = getTitleTextFromNode(titleNode);
        endIndex += 1;
        out.push({
          id,
          label: titleText || defaultIsolationEndTitle(endIndex),
          kind: "end",
        });
      }
    });
  });

  return out;
}

/** 在父节点 `parent` 内查找名为 `childName` 的子节点文档位置。 */
export function findChildNodePos(
  parentPos: number,
  parent: PMNode,
  childName: string,
): number | null {
  let offset = 1;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child.type.name === childName) return parentPos + offset;
    offset += child.nodeSize;
  }
  return null;
}
