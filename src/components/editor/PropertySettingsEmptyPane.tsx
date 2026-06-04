interface PropertySettingsEmptyPaneProps {
  onDismiss: () => void;
}

/** 属性面板已打开但编辑区尚未选中可检视节点时的占位。 */
export function PropertySettingsEmptyPane(props: PropertySettingsEmptyPaneProps) {
  const { onDismiss } = props;

  return (
    <div className="ietm-property-panel">
      <div className="ietm-property-panel__head">
        <h2 className="ietm-property-panel__title">属性设置</h2>
        <button
          type="button"
          className="ietm-property-panel__close"
          onClick={onDismiss}
          aria-label="关闭属性面板"
        >
          ×
        </button>
      </div>
      <div className="ietm-property-panel__body">
        <p className="ietm-prop-hint">
          请在编辑区选中段落、表格、图片、隔离步骤、选项等节点后查看属性。
        </p>
      </div>
    </div>
  );
}
