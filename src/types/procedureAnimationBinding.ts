import type { Editor } from "@tiptap/core";

export type DerivativeBindingNodeType =
  | "media"
  | "scene"
  | "animation"
  | "animationClip"
  | "slice"
  | "webgl";

/** WebGL 指令 `<parameter>` 的 `parameterIdent` 固定值。 */
export const WEBGL_PARAMETER_IDENT = "WEBGL";

/** 绑定菜单中可直接点击绑定的叶子节点类型（含 3D 切面/动画片段与 WebGL 指令）。 */
export const BINDABLE_DERIVATIVE_BINDING_LEAF_TYPES: readonly DerivativeBindingNodeType[] =
  ["slice", "animationClip", "webgl"];

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
