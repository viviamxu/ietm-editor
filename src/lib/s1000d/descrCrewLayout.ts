import type { Editor } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";

import { getDmContentKind } from "./dmContentKind";
import { resolveCrewContentMode } from "./crewModeSwitch";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

export type DescrCrewZone = "warning" | "caution" | "note" | "levelledPara";

const ZONE_ORDER: readonly DescrCrewZone[] = [
  "warning",
  "caution",
  "note",
  "levelledPara",
];

const FMFT_TYPES = new Set([
  "figure",
  "multimedia",
  "table",
  "figureAlts",
  "multimediaAlts",
  "foldout",
]);

const ZONE_LABEL: Record<DescrCrewZone, string> = {
  warning: "警告",
  caution: "注意",
  note: "注",
  levelledPara: "正文",
};

export function getDescrCrewZoneLabel(zone: DescrCrewZone): string {
  return ZONE_LABEL[zone];
}

function zoneForChildType(typeName: string): DescrCrewZone | "fmft" | null {
  if (typeName === "warning") return "warning";
  if (typeName === "caution") return "caution";
  if (typeName === "note") return "note";
  if (typeName === "levelledPara") return "levelledPara";
  if (FMFT_TYPES.has(typeName)) return "fmft";
  return null;
}

export type DescrCrewHost = { pos: number; node: PMNode };

export function isDescrCrewCrewDm(doc: PMNode): boolean {
  if (getDmContentKind(getDescriptionSchema()) !== "crew") return false;
  return resolveCrewContentMode(doc) === "descrCrew";
}

export function findDescrCrewHost(doc: PMNode): DescrCrewHost | null {
  const root = doc.firstChild;
  if (!root || root.type.name !== "descrCrew") return null;
  return { pos: 0, node: root };
}

/** 选区在 `descrCrew` 子树内且不在 `levelledPara` 内 → 使用根级分区插入。 */
export function shouldUseDescrCrewRootInsert($from: ResolvedPos): boolean {
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "levelledPara") return false;
    if ($from.node(d).type.name === "descrCrew") return true;
  }
  return false;
}

export function findDescrCrewHostFromEditor(editor: Editor): DescrCrewHost | null {
  const doc = editor.state.doc;
  if (!isDescrCrewCrewDm(doc)) return null;
  const host = findDescrCrewHost(doc);
  if (!host) return null;
  if (!shouldUseDescrCrewRootInsert(editor.state.selection.$from)) return null;
  return host;
}

export function countDescrCrewZoneChildren(
  descrCrew: PMNode,
): Record<DescrCrewZone, number> {
  const counts: Record<DescrCrewZone, number> = {
    warning: 0,
    caution: 0,
    note: 0,
    levelledPara: 0,
  };
  descrCrew.forEach((child) => {
    const zone = zoneForChildType(child.type.name);
    if (zone && zone !== "fmft") counts[zone]++;
  });
  return counts;
}

/** 在 `descrCrew` 某分区末尾插入（位于后续分区第一个子节点之前）。 */
export function resolveDescrCrewZoneInsertPos(
  descrCrewPos: number,
  descrCrew: PMNode,
  zone: DescrCrewZone,
): number {
  const zoneIndex = ZONE_ORDER.indexOf(zone);
  const laterZones = new Set(ZONE_ORDER.slice(zoneIndex + 1));

  for (let i = 0; i < descrCrew.childCount; i++) {
    const childZone = zoneForChildType(descrCrew.child(i).type.name);
    if (childZone && childZone !== "fmft" && laterZones.has(childZone)) {
      let pos = descrCrewPos + 1;
      for (let j = 0; j < i; j++) pos += descrCrew.child(j).nodeSize;
      return pos;
    }
  }

  return descrCrewPos + descrCrew.nodeSize - 1;
}

function orderedDescrCrewChildren(descrCrew: PMNode): PMNode[] {
  const buckets: Record<DescrCrewZone, PMNode[]> = {
    warning: [],
    caution: [],
    note: [],
    levelledPara: [],
  };
  const fmft: PMNode[] = [];
  const other: PMNode[] = [];

  descrCrew.forEach((child) => {
    const zone = zoneForChildType(child.type.name);
    if (zone === "fmft") fmft.push(child);
    else if (zone) buckets[zone].push(child);
    else other.push(child);
  });

  return [
    ...buckets.warning,
    ...buckets.caution,
    ...buckets.note,
    ...buckets.levelledPara,
    ...fmft,
    ...other,
  ];
}

function descrCrewChildOrderMatches(descrCrew: PMNode, ordered: PMNode[]): boolean {
  if (descrCrew.childCount !== ordered.length) return false;
  for (let i = 0; i < ordered.length; i++) {
    if (descrCrew.child(i) !== ordered[i]) return false;
  }
  return true;
}

/** 将 `descrCrew` 直系子节点重排为 warning* → caution* → note* → levelledPara*。 */
export function normalizeDescrCrewOrderInTransaction(tr: Transaction): boolean {
  const doc = tr.doc;
  if (!isDescrCrewCrewDm(doc)) return false;

  const host = findDescrCrewHost(doc);
  if (!host) return false;

  const ordered = orderedDescrCrewChildren(host.node);
  if (descrCrewChildOrderMatches(host.node, ordered)) return false;

  const from = host.pos + 1;
  const to = host.pos + host.node.nodeSize - 1;
  tr.replaceWith(from, to, Fragment.from(ordered));
  return true;
}

export function resolveDescrCrewAttentionInsertPos(
  editor: Editor,
  attentionType: "warning" | "caution" | "note",
): number | null {
  const host = findDescrCrewHostFromEditor(editor);
  if (!host) return null;
  return resolveDescrCrewZoneInsertPos(host.pos, host.node, attentionType);
}

export function resolveDescrCrewLevelledParaInsertPos(
  editor: Editor,
): number | null {
  const host = findDescrCrewHostFromEditor(editor);
  if (!host) return null;
  return resolveDescrCrewZoneInsertPos(host.pos, host.node, "levelledPara");
}
