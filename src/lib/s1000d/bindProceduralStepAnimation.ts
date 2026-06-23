import type { Editor } from "@tiptap/core";

import { mergeSourceXmlAttrKeysAfterPatch } from "./sourceXmlAttrKeys";

/** 将 3D 动画/切面或 WebGL 指令对应的 `<parameter id>` 写入 `derivativeClassificationRefId`。 */
export function bindProceduralStepDerivativeRef(
  editor: Editor,
  pos: number,
  refId: string,
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "proceduralStep") return false;

  const trimmed = refId.trim();
  if (!trimmed) return false;

  const liveAttrs = { ...node.attrs } as Record<string, unknown>;
  const patch = { derivativeClassificationRefId: trimmed };
  const merged = mergeSourceXmlAttrKeysAfterPatch({
    liveAttrs,
    primaryKey: "id",
    patch,
    schemaAttrKeys: Object.keys(node.type.spec.attrs ?? {}),
  });

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...merged,
      });
      dispatch(tr);
      return true;
    })
    .run();
}