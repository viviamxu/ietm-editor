import type { Node as PMNode } from "@tiptap/pm/model";

import { resolveProceduralStepAtPos } from "./procedureInsert";
import type {
  DerivativeBindingTreeNode,
  DerivativeBindingNodeType,
} from "../../types/procedureAnimationBinding";
import {
  BINDABLE_DERIVATIVE_BINDING_LEAF_TYPES,
  WEBGL_PARAMETER_IDENT,
} from "../../types/procedureAnimationBinding";

export { WEBGL_PARAMETER_IDENT };

export type MultimediaParameterBindingSource = {
  id: string;
  parameterIdent: string | null;
  parameterName: string | null;
  parameterValue: string | null;
};

export type ProceduralStepMultimediaBindingSource = {
  multimediaPos: number;
  title: string;
  infoEntityIdent: string;
  dataType: string | null;
  cnfPath: string | null;
  parameters: MultimediaParameterBindingSource[];
};

export function buildMediaBindingTreeNodeId(
  infoEntityIdent: string,
  multimediaPos: number,
): string {
  return `media:${infoEntityIdent}:${multimediaPos}`;
}

export function isBindableDerivativeBindingLeafType(
  type: DerivativeBindingNodeType,
): boolean {
  return BINDABLE_DERIVATIVE_BINDING_LEAF_TYPES.includes(type);
}

function readMultimediaTitle(multimedia: PMNode): string {
  for (let i = 0; i < multimedia.childCount; i++) {
    const child = multimedia.child(i);
    if (child.type.name === "title") {
      return child.textContent.trim();
    }
  }
  return "";
}

function readMultimediaObjectParameters(
  multimediaObject: PMNode,
): MultimediaParameterBindingSource[] {
  const parameters: MultimediaParameterBindingSource[] = [];
  multimediaObject.forEach((child) => {
    if (child.type.name !== "parameter") return;
    const id = String(child.attrs.id ?? "").trim();
    if (!id) return;
    parameters.push({
      id,
      parameterIdent: (child.attrs.parameterIdent as string | null) ?? null,
      parameterName: (child.attrs.parameterName as string | null) ?? null,
      parameterValue: (child.attrs.parameterValue as string | null) ?? null,
    });
  });
  return parameters;
}

function readMultimediaBindingSource(
  multimedia: PMNode,
  multimediaPos: number,
): ProceduralStepMultimediaBindingSource {
  let title = "";
  let infoEntityIdent = "";
  let dataType: string | null = null;
  let cnfPath: string | null = null;
  const parameters: MultimediaParameterBindingSource[] = [];

  for (let i = 0; i < multimedia.childCount; i++) {
    const child = multimedia.child(i);
    if (child.type.name === "title") {
      title = child.textContent.trim();
      continue;
    }
    if (child.type.name !== "multimediaObject") continue;

    const ident = String(child.attrs.infoEntityIdent ?? "").trim();
    if (ident && !infoEntityIdent) infoEntityIdent = ident;
    if (child.attrs.dataType != null && dataType == null) {
      dataType = String(child.attrs.dataType).trim() || null;
    }
    if (child.attrs.cnfPath != null && cnfPath == null) {
      cnfPath = String(child.attrs.cnfPath).trim() || null;
    }
    parameters.push(...readMultimediaObjectParameters(child));
  }

  if (!title) title = readMultimediaTitle(multimedia);

  return {
    multimediaPos,
    title,
    infoEntityIdent,
    dataType,
    cnfPath,
    parameters,
  };
}

/**
 * 收集当前 `proceduralStep` 直接子级中的 `multimedia`（不含嵌套步骤内多媒体）。
 */
export function collectMultimediaInProceduralStep(
  doc: PMNode,
  proceduralStepPos: number,
): ProceduralStepMultimediaBindingSource[] {
  const resolved = resolveProceduralStepAtPos(doc, proceduralStepPos);
  if (!resolved) return [];

  const { step, stepPos } = resolved;
  const items: ProceduralStepMultimediaBindingSource[] = [];
  let offset = stepPos + 1;

  for (let i = 0; i < step.childCount; i++) {
    const child = step.child(i);
    if (child.type.name === "multimedia") {
      items.push(readMultimediaBindingSource(child, offset));
    }
    offset += child.nodeSize;
  }

  return items;
}

export function hasWebGlParameters(
  parameters: MultimediaParameterBindingSource[],
): boolean {
  return buildWebGlBindingTreeNodes(parameters).length > 0;
}

/** 从 `parameterIdent="WEBGL"` 的 parameters 构建扁平 WebGL 绑定子树。 */
export function buildWebGlBindingTreeNodes(
  parameters: MultimediaParameterBindingSource[],
): DerivativeBindingTreeNode[] {
  const nodes: DerivativeBindingTreeNode[] = [];
  for (const parameter of parameters) {
    if (String(parameter.parameterIdent ?? "").trim() !== WEBGL_PARAMETER_IDENT) {
      continue;
    }
    const id = String(parameter.id ?? "").trim();
    if (!id) continue;
    const label = String(parameter.parameterName ?? "").trim() || "未命名指令";
    nodes.push({ id, label, type: "webgl" });
  }
  return nodes;
}

export function buildMediaBindingTreeNode(
  item: ProceduralStepMultimediaBindingSource,
  children: DerivativeBindingTreeNode[],
): DerivativeBindingTreeNode {
  const ident = item.infoEntityIdent.trim() || "unknown";
  return {
    id: buildMediaBindingTreeNodeId(ident, item.multimediaPos),
    label: item.title.trim() || ident,
    type: "media",
    ...(children.length > 0 ? { children } : {}),
  };
}

/**
 * 从步骤文档构建仅含 WebGL 指令的 `media → webgl` 绑定树（供宿主合并 3D 子树）。
 */
export function buildWebGlMediaBindingTreeFromStep(
  doc: PMNode,
  proceduralStepPos: number,
): DerivativeBindingTreeNode[] {
  return collectMultimediaInProceduralStep(doc, proceduralStepPos)
    .map((item) => {
      const webglChildren = buildWebGlBindingTreeNodes(item.parameters);
      if (webglChildren.length === 0) return null;
      return buildMediaBindingTreeNode(item, webglChildren);
    })
    .filter((node): node is DerivativeBindingTreeNode => node != null);
}

/** 当前步骤内是否存在与 `refId` 匹配的 `<parameter id>`（含 WEBGL / 3D）。 */
export function proceduralStepContainsParameterRef(
  doc: PMNode,
  proceduralStepPos: number,
  refId: string,
): boolean {
  const trimmed = refId.trim();
  if (!trimmed) return false;
  return collectMultimediaInProceduralStep(doc, proceduralStepPos).some((item) =>
    item.parameters.some((parameter) => parameter.id === trimmed),
  );
}
