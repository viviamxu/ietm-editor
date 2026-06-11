import type { Editor } from "@tiptap/core";

export type DerivativeBindingNodeType =
  | "media"
  | "scene"
  | "animation"
  | "animationClip"
  | "slice";

export interface DerivativeBindingTreeNode {
  id: string;
  label: string;
  type: DerivativeBindingNodeType;
  children?: DerivativeBindingTreeNode[];
}

export type FetchDerivativeBindingTreeContext = {
  editor: Editor;
  proceduralStepPos: number;
  proceduralStepId: string | null;
};

export type FetchDerivativeBindingTreeHandler = (
  ctx: FetchDerivativeBindingTreeContext,
) => Promise<DerivativeBindingTreeNode[]>;

export type ProcedureBindingConfig = {
  onFetchDerivativeBindingTree?: FetchDerivativeBindingTreeHandler;
};
