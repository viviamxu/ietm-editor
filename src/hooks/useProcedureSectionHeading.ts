import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useReducer } from "react";

import { resolveProcedureSectionHeading } from "../lib/s1000d/procedureSectionHeading";
import { useProcedureUiConfigStore } from "../store/procedureUiConfigStore";
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

  useEffect(() => {
    const onChange = () => bump();
    editor.on("update", onChange);
    editor.on("selectionUpdate", onChange);
    return () => {
      editor.off("update", onChange);
      editor.off("selectionUpdate", onChange);
    };
  }, [editor]);

  const pos = typeof getPos === "function" ? getPos() : undefined;
  if (pos == null) return EMPTY_HEADING;

  return resolveProcedureSectionHeading(
    editor.state.doc,
    pos,
    config,
    props.node.type.name,
  );
}
