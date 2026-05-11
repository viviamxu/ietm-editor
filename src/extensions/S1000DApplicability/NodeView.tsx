import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type { S1000DApplicabilityAttributes } from "./extension";

export function S1000DApplicabilityNodeView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const attrs = node.attrs as S1000DApplicabilityAttributes;

  return (
    <NodeViewWrapper
      className="s1000d-applicability"
      data-model-codes={attrs.modelCodes}
    >
      <div className="s1000d-applicability__header" contentEditable={false}>
        <span className="s1000d-applicability__title">
          {attrs.conditionLabel}
        </span>
        <label>
          条件
          <input
            value={attrs.modelCodes}
            onChange={(event) =>
              updateAttributes({ modelCodes: event.target.value })
            }
            placeholder="A320,B737"
          />
        </label>
      </div>
      <NodeViewContent className="s1000d-applicability__content" />
    </NodeViewWrapper>
  );
}
