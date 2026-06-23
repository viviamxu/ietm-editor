import type { NodeViewProps } from "@tiptap/react";
import { useReducer } from "react";

import { resolveProcedureSectionHeading } from "../lib/s1000d/procedureSectionHeading";
import { useProcedureUiConfigStore } from "../store/procedureUiConfigStore";
import { useImeSafeEditorSync } from "./useNodeViewEditorState";
import type { ProcedureSectionHeading } from "../types/procedureUiConfig";

const EMPTY_HEADING: ProcedureSectionHeading = {
  number: "",
  label: "",
  full: "",
};

export function useProcedureSectionHeading(
  props: NodeViewProps,
): ProcedureSectionHeading {
  const config = useProcedureUiConfigStore((s) => s.config);
  const { editor, getPos } = props;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useImeSafeEditorSync(editor, ["update", "selectionUpdate"], bump);

  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return EMPTY_HEADING;

  return resolveProcedureSectionHeading(
    editor.state.doc,
    pos,
    config,
    props.node.type.name,
  );
}
