import { Dropdown, Menu } from "@arco-design/web-react";

import type { NodeViewProps } from "@tiptap/react";

import {  Brackets, Trash2, Plus, EllipsisVertical } from "lucide-react";

import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import {
  useImeSafeEditorSync,
  useNodeViewEditorState,
} from "../../hooks/useNodeViewEditorState";

import {
  canDeleteCrewCondition,
  deleteCrewConditionAtPos,
} from "../../lib/s1000d/crewConditionDelete";

import {
  canInsertCrewDrillStepInBlock,
  canInsertNestedConditionInBlock,
  canInsertSiblingCaseAfterChain,
  canInsertSiblingElseIfAfterChain,
  canInsertSiblingIfAfterChain,
  insertCrewDrillStepInBlock,
  insertNestedConditionInBlock,
  insertSiblingCaseAfterChain,
  insertSiblingElseIfAfterChain,
  insertSiblingIfAfterChain,
} from "../../lib/s1000d/crewConditionInsert";

/** 条件块 hover 显示网格图标；点击图标打开操作菜单。 */

export function CrewConditionBlockMenu(props: {
  editor: NodeViewProps["editor"];

  getPos: NodeViewProps["getPos"];

  kind: string;

  blockLabel: string;
}) {
  const { editor, getPos, kind, blockLabel } = props;

  const { readOnly } = useNodeViewEditorState(editor);

  const [, bump] = useReducer((n: number) => n + 1, 0);

  useImeSafeEditorSync(editor, ["update", "selectionUpdate"], bump);

  const [menuOpen, setMenuOpen] = useState(false);

  const blockPos = typeof getPos === "function" ? getPos() : null;

  const showElseIf =
    (kind === "if" || kind === "elseIf") &&
    blockPos != null &&
    canInsertSiblingElseIfAfterChain(editor, blockPos);

  const showSiblingIf =
    (kind === "if" || kind === "elseIf") &&
    blockPos != null &&
    canInsertSiblingIfAfterChain(editor, blockPos);

  const showNestedIf =
    blockPos != null && canInsertNestedConditionInBlock(editor, blockPos, "if");

  const showNestedCase =
    (kind === "if" || kind === "elseIf") &&
    blockPos != null &&
    canInsertNestedConditionInBlock(editor, blockPos, "case");

  const showSiblingCase =
    kind === "case" &&
    blockPos != null &&
    canInsertSiblingCaseAfterChain(editor, blockPos);

  const showCrewDrillStep =
    blockPos != null && canInsertCrewDrillStepInBlock(editor, blockPos);

  const canDelete =
    blockPos != null && canDeleteCrewCondition(editor.state.doc, blockPos);

  const hasInsert =
    showElseIf ||
    showSiblingIf ||
    showNestedIf ||
    showNestedCase ||
    showSiblingCase ||
    showCrewDrillStep;

  const selectWholeBlock = useCallback((): boolean => {
    if (blockPos == null) return false;

    return editor.chain().focus().setNodeSelection(blockPos).run();
  }, [blockPos, editor]);

  const runAndClose = useCallback((action: () => boolean) => {
    if (action()) setMenuOpen(false);
  }, []);

  const runMenuAction = useCallback(
    (e: ReactMouseEvent, action: () => boolean) => {
      e.preventDefault();

      e.stopPropagation();

      runAndClose(action);
    },

    [runAndClose],
  );

  const droplist = useMemo(() => {
    const insertItems: ReactNode[] = [];

    if (showSiblingIf) {
      insertItems.push(
        <Menu.Item
          key="sibling-if"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertSiblingIfAfterChain(editor, blockPos)
                : false,
            )
          }
        >
          If（接在链后）
        </Menu.Item>,
      );
    }

    if (showElseIf) {
      insertItems.push(
        <Menu.Item
          key="sibling-elseif"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertSiblingElseIfAfterChain(editor, blockPos)
                : false,
            )
          }
        >
          ElseIf（接在链后）
        </Menu.Item>,
      );
    }

    if (showSiblingCase) {
      insertItems.push(
        <Menu.Item
          key="sibling-case"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertSiblingCaseAfterChain(editor, blockPos)
                : false,
            )
          }
        >
          Case（接在链后）
        </Menu.Item>,
      );
    }

    if (showNestedIf) {
      insertItems.push(
        <Menu.Item
          key="nested-if"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertNestedConditionInBlock(editor, blockPos, "if")
                : false,
            )
          }
        >
          嵌套 If
        </Menu.Item>,
      );
    }

    if (showNestedCase) {
      insertItems.push(
        <Menu.Item
          key="nested-case"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertNestedConditionInBlock(editor, blockPos, "case")
                : false,
            )
          }
        >
          Case（分支内）
        </Menu.Item>,
      );
    }

    if (showCrewDrillStep) {
      insertItems.push(
        <Menu.Item
          key="crew-drill-step"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, () =>
              blockPos != null
                ? insertCrewDrillStepInBlock(editor, blockPos)
                : false,
            )
          }
        >
          操作卡（crewDrillStep）
        </Menu.Item>,
      );
    }

    return (
      <Menu onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}>
        <Menu.Item
          key="select"
          onMouseDown={(e: ReactMouseEvent) =>
            runMenuAction(e, selectWholeBlock)
          }
        >
          <span className="s1000d-crew-condition-menu__item-label">
            <Brackets size={14} strokeWidth={2} aria-hidden />
            选中整块
          </span>
        </Menu.Item>

        {!readOnly && hasInsert ? (
          <Menu.SubMenu
            key="insert"
            title={
              <span className="s1000d-crew-condition-menu__item-label">
                <Plus size={14} aria-hidden />
                添加内容
              </span>
            }
          >
            {insertItems}
          </Menu.SubMenu>
        ) : null}

        {!readOnly ? (
          <Menu.Item
            key="delete"
            disabled={!canDelete}
            className="s1000d-crew-condition-menu__delete"
            onMouseDown={(e: ReactMouseEvent) => {
              if (!canDelete) return;

              runMenuAction(e, () =>
                blockPos != null
                  ? deleteCrewConditionAtPos(editor, blockPos)
                  : false,
              );
            }}
          >
            <span className="s1000d-crew-condition-menu__item-label">
              <Trash2 size={14} aria-hidden />
              删除
            </span>
          </Menu.Item>
        ) : null}
      </Menu>
    );
  }, [
    blockLabel,

    blockPos,

    canDelete,

    editor,

    hasInsert,

    readOnly,

    runMenuAction,

    selectWholeBlock,

    showElseIf,

    showSiblingIf,

    showNestedCase,

    showNestedIf,

    showSiblingCase,

    showCrewDrillStep,
  ]);

  if (blockPos == null) return null;

  return (
    <div
      className={[
        "s1000d-crew-condition__menu",

        menuOpen ? "s1000d-crew-condition__menu--open" : null,
      ]

        .filter(Boolean)

        .join(" ")}
      contentEditable={false}
    >
      <Dropdown
        trigger="click"
        position="bl"
        popupVisible={menuOpen}
        onVisibleChange={setMenuOpen}
        droplist={droplist}
        getPopupContainer={() =>
          document.getElementById("ietm-sdk-portal-root") || document.body
        }
      >
        <button
          type="button"
          className="s1000d-crew-condition__action-handle"
          contentEditable={false}
          tabIndex={-1}
          aria-label={`${blockLabel}操作`}
          aria-expanded={menuOpen}
          title={`${blockLabel}操作`}
          onMouseDown={(e: ReactMouseEvent) => e.preventDefault()}
        >
          <EllipsisVertical  size={14} strokeWidth={2} aria-hidden />
        </button>
      </Dropdown>
    </div>
  );
}
