import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { getTitleTextFromNode } from "./faultIsolationDefaultTitles";

export type IsolationStepRefOption = {
  id: string;
  label: string;
  kind: "step" | "end";
};

export { getTitleTextFromNode };

/** 下拉展示：`stp-0002` 或 `stp-0002（步骤标题文案）`。 */
export function formatIsolationStepRefLabel(
  id: string,
  titleText: string,
): string {
  const title = titleText.trim();
  return title ? `${id}（${title}）` : id;
}

function readTitleFromBlock(child: PMNode): string {
  let titleNode: PMNode | null = null;
  child.forEach((c) => {
    if (c.type.name === "title") titleNode = c;
  });
  return getTitleTextFromNode(titleNode);
}

/** 收集同一 `isolationMainProcedure` 内可供「下一步」选择的步骤/结束块。 */
export function collectIsolationStepRefs(editor: Editor): IsolationStepRefOption[] {
  const { doc } = editor.state;
  const out: IsolationStepRefOption[] = [];

  doc.descendants((node) => {
    if (node.type.name !== "isolationMainProcedure") return;
    node.forEach((child) => {
      const id = String(child.attrs.id ?? "").trim();
      if (!id) return;
      if (child.type.name === "isolationStep") {
        out.push({
          id,
          label: formatIsolationStepRefLabel(id, readTitleFromBlock(child)),
          kind: "step",
        });
      } else if (child.type.name === "isolationProcedureEnd") {
        out.push({
          id,
          label: formatIsolationStepRefLabel(id, readTitleFromBlock(child)),
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
