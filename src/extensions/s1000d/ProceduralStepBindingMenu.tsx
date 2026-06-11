import { Dropdown, Menu } from "@arco-design/web-react";
import { IconCheck } from "@arco-design/web-react/icon";
import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";

import type {
  DerivativeBindingNodeType,
  DerivativeBindingTreeNode,
} from "../../types/procedureAnimationBinding";

/** 有子节点时：自身可绑定，子节点平铺展示（与 animation 一致）。 */
const BINDABLE_WITH_FLAT_CHILDREN = new Set<DerivativeBindingNodeType>([
  "scene",
  "animation",
]);

function renderBindingMenuItem(
  node: DerivativeBindingTreeNode,
  boundId: string | null,
  onBind: (id: string) => void,
  className?: string,
): ReactNode {
  const selected = boundId === node.id;
  return (
    <Menu.Item
      key={node.id}
      className={className}
      onClick={() => onBind(node.id)}
    >
      {selected ? (
        <IconCheck className="s1000d-procedural-step-binding__check" />
      ) : null}
      {node.label}
    </Menu.Item>
  );
}

function renderBindingMenuNodes(
  nodes: DerivativeBindingTreeNode[],
  boundId: string | null,
  onBind: (id: string) => void,
): ReactNode[] {
  return nodes.flatMap((node) => {
    if (node.type === "media") {
      return (
        <Menu.SubMenu key={node.id} title={node.label}>
          {renderBindingMenuNodes(node.children ?? [], boundId, onBind)}
        </Menu.SubMenu>
      );
    }

    const children = node.children ?? [];

    if (BINDABLE_WITH_FLAT_CHILDREN.has(node.type) && children.length > 0) {
      return [
        renderBindingMenuItem(node, boundId, onBind),
        ...renderBindingMenuNodes(children, boundId, onBind),
      ];
    }

    if (children.length > 0) {
      return (
        <Menu.SubMenu key={node.id} title={node.label}>
          {renderBindingMenuNodes(children, boundId, onBind)}
        </Menu.SubMenu>
      );
    }

    return renderBindingMenuItem(node, boundId, onBind);
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
