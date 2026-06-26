import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import {
  CREW_CONDITION_TYPES,
  CREW_DRILL_STEP,
  LEVELLED_PARA,
  LIST_ITEM,
  LIST_TYPES,
  PROCEDURAL_STEP,
  collectAncestorDepths,
  getInnermostCrewDrillStepDepth,
  getInnermostLevelledParaDepth,
  getInnermostProceduralStepDepth,
  getListItemDepth,
  isInCrewDrillStepTitleOrPara,
  isInLevelledParaTitleOrPara,
  isInListNestingContext,
  isInProceduralStepTitleOrPara,
  listItemIndexInParentList,
} from "./nestingLevelShared";

type ListLiftTarget = {
  outerListFrom: number;
  /** 外层 list 中承载嵌套列表的 listItem 下标（抬升项插入其后） */
  parentItemIndex: number;
  /** 内层列表在文档中的起始位置 */
  innerListFrom: number;
  /**
   * 内层列表在外层 listItem 内的子下标；
   * `-1` 表示内层列表与外层 list 同属 levelledPara 子级（平级 ul）。
   */
  innerListChildIndex: number;
  itemIndex: number;
};

function positionOfChildInParent(
  parentStart: number,
  parent: PMNode,
  childIndex: number,
): number {
  let pos = parentStart + 1;
  for (let i = 0; i < childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

function findNestedListIndexInListItem(
  listItem: PMNode,
  innerList: PMNode,
): number {
  for (let i = 0; i < listItem.childCount; i++) {
    if (listItem.child(i) === innerList) return i;
  }
  for (let i = 0; i < listItem.childCount; i++) {
    if (LIST_TYPES.has(listItem.child(i).type.name)) return i;
  }
  return -1;
}

function buildLiftTarget(
  outerListFrom: number,
  parentItemIndex: number,
  innerListFrom: number,
  innerListChildIndex: number,
  itemIndex: number,
): ListLiftTarget {
  return {
    outerListFrom,
    parentItemIndex,
    innerListFrom,
    innerListChildIndex,
    itemIndex,
  };
}

/** 光标在内层 listItem 内（标准嵌套 listItem → list → listItem）。 */
function targetFromNestedListItem($pos: ResolvedPos): ListLiftTarget | null {
  const itemDepth = getListItemDepth($pos);
  if (itemDepth < 0) return null;

  const innerListDepth = itemDepth - 1;
  const innerList = $pos.node(innerListDepth);
  if (!LIST_TYPES.has(innerList.type.name)) return null;

  const itemIndex = listItemIndexInParentList($pos, itemDepth);
  const innerListFrom = $pos.before(innerListDepth);
  const parentListItemDepth = innerListDepth - 1;
  // 内层 list 的父节点必须是 listItem（光标在外层 li 的 paragraph 时 itemDepth-1 是整表，此处为 null）
  if ($pos.node(parentListItemDepth).type.name !== LIST_ITEM) return null;

  const outerListDepth = parentListItemDepth - 1;
  if (outerListDepth < 0) return null;
  if (!LIST_TYPES.has($pos.node(outerListDepth).type.name)) return null;

  const parentItem = $pos.node(parentListItemDepth);
  const innerListChildIndex = findNestedListIndexInListItem(
    parentItem,
    innerList,
  );
  if (innerListChildIndex < 0) return null;

  return buildLiftTarget(
    $pos.before(outerListDepth),
    listItemIndexInParentList($pos, parentListItemDepth),
    innerListFrom,
    innerListChildIndex,
    itemIndex,
  );
}

/**
 * 光标在外层 listItem 内、嵌套列表之后（或块缝隙），抬升该嵌套列表最后一项。
 */
function targetFromOuterListItemWithNestedList(
  $pos: ResolvedPos,
): ListLiftTarget | null {
  const itemDepth = getListItemDepth($pos);
  if (itemDepth < 0) return null;

  const listDepth = itemDepth - 1;
  if (!LIST_TYPES.has($pos.node(listDepth).type.name)) return null;

  const parentItem = $pos.node(itemDepth);
  let innerList: PMNode | null = null;
  let innerListChildIndex = -1;
  for (let i = 0; i < parentItem.childCount; i++) {
    const child = parentItem.child(i);
    if (LIST_TYPES.has(child.type.name)) {
      innerList = child;
      innerListChildIndex = i;
      break;
    }
  }
  if (!innerList || innerList.childCount === 0) return null;

  const listItemStart = $pos.before(itemDepth);
  const innerListFrom = positionOfChildInParent(
    listItemStart,
    parentItem,
    innerListChildIndex,
  );

  return buildLiftTarget(
    $pos.before(listDepth),
    listItemIndexInParentList($pos, itemDepth),
    innerListFrom,
    innerListChildIndex,
    innerList.childCount - 1,
  );
}

/** `nodeBefore` 为嵌套列表，光标在其后且位于外层 listItem 内。 */
function targetFromNodeBeforeNestedList(
  $from: ResolvedPos,
  innerList: PMNode,
): ListLiftTarget | null {
  const itemDepth = getListItemDepth($from);
  if (itemDepth < 0) return null;

  const listDepth = itemDepth - 1;
  if (!LIST_TYPES.has($from.node(listDepth).type.name)) return null;

  const parentItem = $from.node(itemDepth);
  const innerListChildIndex = findNestedListIndexInListItem(
    parentItem,
    innerList,
  );
  if (innerListChildIndex < 0) return null;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const nested = targetFromNestedListItem($prev);
    if (nested) return nested;
  }

  const listItemStart = $from.before(itemDepth);
  const innerListFrom = positionOfChildInParent(
    listItemStart,
    parentItem,
    innerListChildIndex,
  );

  return buildLiftTarget(
    $from.before(listDepth),
    listItemIndexInParentList($from, itemDepth),
    innerListFrom,
    innerListChildIndex,
    innerList.childCount - 1,
  );
}

/**
 * 解析列表升级目标：内层 listItem、外层 listItem 嵌套列表尾、pos-1 / nodeBefore 回退。
 */
function resolveListLiftTarget($from: ResolvedPos): ListLiftTarget | null {
  const direct = targetFromNestedListItem($from);
  if (direct) return direct;

  const inOuterAfterNested = targetFromOuterListItemWithNestedList($from);
  if (inOuterAfterNested) return inOuterAfterNested;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const fromPrevItem = targetFromNestedListItem($prev);
    if (fromPrevItem) return fromPrevItem;
    const fromPrevOuter = targetFromOuterListItemWithNestedList($prev);
    if (fromPrevOuter) return fromPrevOuter;
  }

  const nodeBefore = $from.nodeBefore;
  if (nodeBefore && LIST_TYPES.has(nodeBefore.type.name) && nodeBefore.childCount > 0) {
    return targetFromNodeBeforeNestedList($from, nodeBefore);
  }

  return null;
}

function selectionInHostBlockTitle(
  doc: PMNode,
  hostPos: number,
  hostTypeName: string,
): TextSelection | null {
  if (hostPos < 0 || hostPos > doc.content.size) return null;

  const node = doc.nodeAt(hostPos);
  if (!node || node.type.name !== hostTypeName) return null;

  let offset = hostPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "title") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  const fallback = Math.min(hostPos + 2, doc.content.size);
  if (fallback < 0 || fallback > doc.content.size) return null;
  return TextSelection.create(doc, fallback);
}

function selectionInLevelledParaTitle(
  doc: PMNode,
  levelledParaPos: number,
): TextSelection | null {
  return selectionInHostBlockTitle(doc, levelledParaPos, LEVELLED_PARA);
}

function selectionInProceduralStepTitle(
  doc: PMNode,
  proceduralStepPos: number,
): TextSelection | null {
  return selectionInHostBlockTitle(doc, proceduralStepPos, PROCEDURAL_STEP);
}

function selectionInCrewDrillStepTitle(
  doc: PMNode,
  crewDrillStepPos: number,
): TextSelection | null {
  return selectionInHostBlockTitle(doc, crewDrillStepPos, CREW_DRILL_STEP);
}

function canLiftHostBlockToParentSibling(
  $from: ResolvedPos,
  hostTypeName: string,
  hostDepth: number,
  isInHostTitleOrPara: (pos: ResolvedPos) => boolean,
): boolean {
  if (isInListNestingContext($from)) return false;
  if (hostDepth < 1) return false;
  if ($from.node(hostDepth - 1).type.name !== hostTypeName) return false;
  if (collectAncestorDepths($from, hostTypeName).length < 2) return false;
  return isInHostTitleOrPara($from);
}

function canLiftLevelledParaToParentSibling($from: ResolvedPos): boolean {
  return canLiftHostBlockToParentSibling(
    $from,
    LEVELLED_PARA,
    getInnermostLevelledParaDepth($from),
    isInLevelledParaTitleOrPara,
  );
}

function canLiftProceduralStepToParentSibling($from: ResolvedPos): boolean {
  return canLiftHostBlockToParentSibling(
    $from,
    PROCEDURAL_STEP,
    getInnermostProceduralStepDepth($from),
    isInProceduralStepTitleOrPara,
  );
}

const CREW_STEP_LIFT_PARENTS = new Set([
  CREW_DRILL_STEP,
  ...CREW_CONDITION_TYPES,
]);

function canLiftCrewDrillStepToParentSibling($from: ResolvedPos): boolean {
  if (isInListNestingContext($from)) return false;

  const stepDepth = getInnermostCrewDrillStepDepth($from);
  if (stepDepth < 1) return false;
  if (!isInCrewDrillStepTitleOrPara($from)) return false;

  const parentType = $from.node(stepDepth - 1).type.name;
  if (parentType === "crewDrill") return false;
  if (!CREW_STEP_LIFT_PARENTS.has(parentType)) return false;

  if (parentType === CREW_DRILL_STEP) {
    return collectAncestorDepths($from, CREW_DRILL_STEP).length >= 2;
  }

  return true;
}

function liftListItemAtTarget(editor: Editor, target: ListLiftTarget): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const {
        outerListFrom,
        parentItemIndex,
        innerListFrom,
        innerListChildIndex,
        itemIndex,
      } = target;

      const outerList = state.doc.nodeAt(outerListFrom);
      const innerList = state.doc.nodeAt(innerListFrom);
      if (!outerList || !innerList) return false;
      if (!LIST_TYPES.has(outerList.type.name)) return false;
      if (!LIST_TYPES.has(innerList.type.name)) return false;
      if (itemIndex >= innerList.childCount) return false;
      if (parentItemIndex >= outerList.childCount) return false;

      const listItemType = state.schema.nodes.listItem;
      if (!listItemType) return false;

      const currentItem = innerList.child(itemIndex);

      const innerChildren: PMNode[] = [];
      for (let i = 0; i < innerList.childCount; i++) {
        if (i !== itemIndex) innerChildren.push(innerList.child(i));
      }

      const newInnerList =
        innerChildren.length > 0
          ? innerList.type.create(innerList.attrs, innerChildren)
          : null;

      const finalOuter: PMNode[] = [];
      if (innerListChildIndex >= 0) {
        const parentItem = outerList.child(parentItemIndex);
        const parentChildren: PMNode[] = [];
        for (let i = 0; i < parentItem.childCount; i++) {
          if (i === innerListChildIndex) {
            if (newInnerList) parentChildren.push(newInnerList);
          } else {
            parentChildren.push(parentItem.child(i));
          }
        }
        const newParentItem = listItemType.create(
          parentItem.attrs,
          parentChildren,
        );
        for (let i = 0; i < outerList.childCount; i++) {
          if (i < parentItemIndex) {
            finalOuter.push(outerList.child(i));
          } else if (i === parentItemIndex) {
            finalOuter.push(newParentItem);
            finalOuter.push(currentItem);
          } else {
            finalOuter.push(outerList.child(i));
          }
        }
        if (!dispatch) return true;
        tr.replaceWith(
          outerListFrom,
          outerListFrom + outerList.nodeSize,
          outerList.type.create(outerList.attrs, finalOuter),
        );
      } else {
        for (let i = 0; i < outerList.childCount; i++) {
          finalOuter.push(outerList.child(i));
          if (i === parentItemIndex) finalOuter.push(currentItem);
        }
        const newOuterList = outerList.type.create(outerList.attrs, finalOuter);
        const innerListEnd = innerListFrom + innerList.nodeSize;
        if (!dispatch) return true;
        if (newInnerList) {
          tr.replaceWith(
            outerListFrom,
            outerListFrom + outerList.nodeSize,
            newOuterList,
          );
          tr.replaceWith(innerListFrom, innerListEnd, newInnerList);
        } else {
          tr.replaceWith(outerListFrom, innerListEnd, newOuterList);
        }
      }

      const mappedFrom = tr.mapping.map(state.selection.from, -1);
      tr.setSelection(
        TextSelection.near(
          tr.doc.resolve(Math.min(Math.max(0, mappedFrom), tr.doc.content.size)),
          -1,
        ),
      );
      dispatch(tr);
      return true;
    })
    .run();
}

/**
 * 将光标所在的最内层宿主块从父块中抽出，与父块并列。
 * 若父块在移除后无子节点，则去掉空父块，仅保留抬升后的节。
 */
function liftHostBlockToParentSibling(
  editor: Editor,
  getHostDepth: (pos: ResolvedPos) => number,
  canLift: (pos: ResolvedPos) => boolean,
  selectionInTitle: (doc: PMNode, hostPos: number) => TextSelection | null,
): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      if (!canLift($from)) return false;

      const childDepth = getHostDepth($from);
      const parentDepth = childDepth - 1;
      const grandDepth = parentDepth - 1;
      if (grandDepth < 0) return false;

      const childHost = $from.node(childDepth);
      const parentHost = $from.node(parentDepth);
      const grandparent = $from.node(grandDepth);
      const parentIndex = $from.index(grandDepth);
      const childIndexInParent = $from.index(parentDepth);

      const parentChildren: PMNode[] = [];
      for (let i = 0; i < parentHost.childCount; i++) {
        if (i !== childIndexInParent) parentChildren.push(parentHost.child(i));
      }

      const hostType = parentHost.type;
      let newParent: PMNode | null = null;
      if (parentChildren.length > 0) {
        try {
          newParent = hostType.create(parentHost.attrs, parentChildren);
        } catch {
          return false;
        }
        if (!hostType.validContent(newParent.content)) return false;
      }

      const gpType = grandparent.type;
      const gpChildren: PMNode[] = [];
      for (let i = 0; i < grandparent.childCount; i++) {
        if (i < parentIndex) {
          gpChildren.push(grandparent.child(i));
        } else if (i === parentIndex) {
          if (newParent) gpChildren.push(newParent);
          gpChildren.push(childHost);
        } else {
          gpChildren.push(grandparent.child(i));
        }
      }

      let newGrandparent: PMNode;
      try {
        newGrandparent = gpType.create(grandparent.attrs, gpChildren);
      } catch {
        return false;
      }
      if (!gpType.validContent(newGrandparent.content)) return false;

      if (!dispatch) return true;

      const childStart = $from.before(childDepth);
      const grandFrom = grandDepth === 0 ? 0 : $from.before(grandDepth);
      const grandTo =
        grandDepth === 0 ? state.doc.content.size : $from.after(grandDepth);
      if (grandDepth === 0) {
        tr.replaceWith(grandFrom, grandTo, Fragment.from(gpChildren));
      } else {
        tr.replaceWith(grandFrom, grandTo, newGrandparent);
      }

      const mappedChildStart = tr.mapping.map(childStart);
      const sel =
        selectionInTitle(tr.doc, mappedChildStart) ??
        TextSelection.near(
          tr.doc.resolve(Math.min(mappedChildStart + 1, tr.doc.content.size)),
          1,
        );
      tr.setSelection(sel);

      dispatch(tr);
      return true;
    })
    .run();
}

function liftLevelledParaToParentSibling(editor: Editor): boolean {
  return liftHostBlockToParentSibling(
    editor,
    getInnermostLevelledParaDepth,
    canLiftLevelledParaToParentSibling,
    selectionInLevelledParaTitle,
  );
}

function liftProceduralStepToParentSibling(editor: Editor): boolean {
  return liftHostBlockToParentSibling(
    editor,
    getInnermostProceduralStepDepth,
    canLiftProceduralStepToParentSibling,
    selectionInProceduralStepTitle,
  );
}

function findTopLevelCrewDrillStepDepth($from: ResolvedPos): number {
  for (let d = 1; d <= $from.depth; d++) {
    if (
      $from.node(d).type.name === CREW_DRILL_STEP &&
      $from.node(d - 1).type.name === "crewDrill"
    ) {
      return d;
    }
  }
  return -1;
}

/**
 * 从 `case` / `if` / `elseIf` 内抽出 `crewDrillStep`，作为 `crewDrill` 下与一级操作卡同级的步骤。
 */
function liftCrewDrillStepFromConditionToDrillSibling(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      if (!canLiftCrewDrillStepToParentSibling($from)) return false;

      const stepDepth = getInnermostCrewDrillStepDepth($from);
      const parentDepth = stepDepth - 1;
      const parentType = $from.node(parentDepth).type.name;
      if (!CREW_CONDITION_TYPES.has(parentType)) return false;

      const topStepDepth = findTopLevelCrewDrillStepDepth($from);
      if (topStepDepth < 0) return false;

      const crewDrillDepth = topStepDepth - 1;
      if ($from.node(crewDrillDepth).type.name !== "crewDrill") return false;

      const childHost = $from.node(stepDepth);
      const childIndexInCondition = $from.index(parentDepth);
      const condition = $from.node(parentDepth);

      const conditionChildren: PMNode[] = [];
      for (let i = 0; i < condition.childCount; i++) {
        if (i !== childIndexInCondition) {
          conditionChildren.push(condition.child(i));
        }
      }

      let newCondition: PMNode;
      try {
        newCondition = condition.type.create(condition.attrs, conditionChildren);
      } catch {
        return false;
      }
      if (!condition.type.validContent(newCondition.content)) return false;

      const topStep = $from.node(topStepDepth);
      const conditionIndexInTopStep = $from.index(topStepDepth);

      const topStepChildren: PMNode[] = [];
      for (let i = 0; i < topStep.childCount; i++) {
        if (i === conditionIndexInTopStep) {
          topStepChildren.push(newCondition);
        } else {
          topStepChildren.push(topStep.child(i));
        }
      }

      let newTopStep: PMNode;
      try {
        newTopStep = topStep.type.create(topStep.attrs, topStepChildren);
      } catch {
        return false;
      }
      if (!topStep.type.validContent(newTopStep.content)) return false;

      const crewDrill = $from.node(crewDrillDepth);
      const topStepIndexInDrill = $from.index(crewDrillDepth);

      const drillChildren: PMNode[] = [];
      for (let i = 0; i < crewDrill.childCount; i++) {
        if (i === topStepIndexInDrill) {
          drillChildren.push(newTopStep);
          drillChildren.push(childHost);
        } else {
          drillChildren.push(crewDrill.child(i));
        }
      }

      let newDrill: PMNode;
      try {
        newDrill = crewDrill.type.create(crewDrill.attrs, drillChildren);
      } catch {
        return false;
      }
      if (!crewDrill.type.validContent(newDrill.content)) return false;

      if (!dispatch) return true;

      const drillFrom = $from.before(crewDrillDepth);
      tr.replaceWith(drillFrom, drillFrom + crewDrill.nodeSize, newDrill);

      let liftedPos = drillFrom + 1;
      for (let i = 0; i < topStepIndexInDrill; i++) {
        liftedPos += crewDrill.child(i).nodeSize;
      }
      liftedPos += newTopStep.nodeSize;

      const sel =
        selectionInCrewDrillStepTitle(tr.doc, liftedPos) ??
        TextSelection.near(
          tr.doc.resolve(Math.min(liftedPos + 1, tr.doc.content.size)),
          1,
        );
      tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}

function liftCrewDrillStepToParentSibling(editor: Editor): boolean {
  const $from = editor.state.selection.$from;
  const stepDepth = getInnermostCrewDrillStepDepth($from);
  if (
    stepDepth >= 1 &&
    CREW_CONDITION_TYPES.has($from.node(stepDepth - 1).type.name) &&
    findTopLevelCrewDrillStepDepth($from) >= 0
  ) {
    if (liftCrewDrillStepFromConditionToDrillSibling(editor)) return true;
  }

  return liftHostBlockToParentSibling(
    editor,
    getInnermostCrewDrillStepDepth,
    canLiftCrewDrillStepToParentSibling,
    selectionInCrewDrillStepTitle,
  );
}

export function canPromoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const $from = editor.state.selection.$from;
  if (resolveListLiftTarget($from)) return true;
  if (canLiftCrewDrillStepToParentSibling($from)) return true;
  if (canLiftProceduralStepToParentSibling($from)) return true;
  return canLiftLevelledParaToParentSibling($from);
}

export function promoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;

  const $from = editor.state.selection.$from;
  const listTarget = resolveListLiftTarget($from);

  if (listTarget) {
    return liftListItemAtTarget(editor, listTarget);
  }

  if (canLiftCrewDrillStepToParentSibling($from)) {
    return liftCrewDrillStepToParentSibling(editor);
  }

  if (canLiftProceduralStepToParentSibling($from)) {
    return liftProceduralStepToParentSibling(editor);
  }

  if (canLiftLevelledParaToParentSibling($from)) {
    return liftLevelledParaToParentSibling(editor);
  }

  return false;
}
