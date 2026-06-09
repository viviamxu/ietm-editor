import { Dropdown, Menu } from "@arco-design/web-react";
import { IconCheck } from "@arco-design/web-react/icon";
import { LayoutGrid } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

import type { DerivativeBindingTreeNode } from "../../types/procedureAnimationBinding";

function stopBindableTitlePointer(e: ReactMouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function renderBindingMenuNodes(
  nodes: DerivativeBindingTreeNode[],
  boundId: string | null,
  onBind: (id: string) => void,
): ReactNode[] {
  return nodes.map((node) => {
    if (node.type === "media") {
      return (
        <Menu.SubMenu key={node.id} title={node.label}>
          {renderBindingMenuNodes(node.children ?? [], boundId, onBind)}
        </Menu.SubMenu>
      );
    }

    const selected = boundId === node.id;
    const children = node.children ?? [];

    if (children.length > 0) {
      return (
        <Menu.SubMenu
          key={node.id}
          title={
            <span
              className="s1000d-procedural-step-binding__bindable-title"
              onMouseDown={stopBindableTitlePointer}
              onClick={(e) => {
                stopBindableTitlePointer(e);
                onBind(node.id);
              }}
            >
              {selected ? (
                <IconCheck className="s1000d-procedural-step-binding__check" />
              ) : null}
              {node.label}
            </span>
          }
        >
          {renderBindingMenuNodes(children, boundId, onBind)}
        </Menu.SubMenu>
      );
    }

    return (
      <Menu.Item key={node.id} onClick={() => onBind(node.id)}>
        {selected ? (
          <IconCheck className="s1000d-procedural-step-binding__check" />
        ) : null}
        {node.label}
      </Menu.Item>
    );
  });
}

export function ProceduralStepBindingMenu(props: {
  visible: boolean;
  disabled?: boolean;
  boundId: string | null;
  tree: DerivativeBindingTreeNode[];
  loading?: boolean;
  onBind: (id: string) => void;
  onVisibleChange: (visible: boolean) => void;
}) {
  const {
    visible,
    disabled,
    boundId,
    tree,
    loading,
    onBind,
    onVisibleChange,
  } = props;

  const hasBound = Boolean(boundId?.trim());

  const droplist = (
    <Menu>
      <Menu.SubMenu
        key="bind-animation"
        title={
          <span className="s1000d-procedural-step-binding__root">
            {hasBound ? (
              <IconCheck className="s1000d-procedural-step-binding__check" />
            ) : null}
            绑定动画
          </span>
        }
      >
        {loading ? (
          <Menu.Item key="loading" disabled>
            加载中…
          </Menu.Item>
        ) : tree.length === 0 ? (
          <Menu.Item key="empty" disabled>
            暂无数据
          </Menu.Item>
        ) : (
          renderBindingMenuNodes(tree, boundId, onBind)
        )}
      </Menu.SubMenu>
    </Menu>
  );

  return (
    <Dropdown
      trigger="click"
      position="bl"
      popupVisible={visible}
      onVisibleChange={onVisibleChange}
      droplist={droplist}
      getPopupContainer={() =>
        document.getElementById("ietm-sdk-portal-root") || document.body
      }
    >
      <button
        type="button"
        className="s1000d-procedural-step__action-handle"
        contentEditable={false}
        tabIndex={-1}
        disabled={disabled}
        aria-label="程序步骤操作"
        onMouseDown={(e) => e.preventDefault()}
      >
        <LayoutGrid size={14} strokeWidth={2} aria-hidden />
      </button>
    </Dropdown>
  );
}
