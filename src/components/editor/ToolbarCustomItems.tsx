import type { ToolbarItemContext, ToolbarItemPlacement } from "../../types/toolbar";
import { useToolbarConfigStore } from "../../store/toolbarConfigStore";

function resolveToolbarFlag(
  value: boolean | ((ctx: ToolbarItemContext) => boolean) | undefined,
  ctx: ToolbarItemContext,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  return typeof value === "function" ? value(ctx) : value;
}

export function ToolbarCustomItems(props: {
  placement: ToolbarItemPlacement;
  ctx: ToolbarItemContext;
}) {
  const customItems = useToolbarConfigStore((s) => s.customItems) ?? [];
  const { placement, ctx } = props;

  const visible = customItems
    .filter((item) => (item.placement ?? "insert") === placement)
    .filter((item) => item.tab == null || item.tab === ctx.activeTabKey)
    .filter((item) => !resolveToolbarFlag(item.hidden, ctx, false))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((item) => {
        const disabled =
          ctx.formatBarLocked ||
          resolveToolbarFlag(item.disabled, ctx, false);
        return (
          <button
            key={item.id}
            type="button"
            className="ietm-icon-btn"
            disabled={disabled}
            title={item.title}
            aria-label={item.ariaLabel ?? item.title}
            onClick={() => item.onClick(ctx)}
          >
            {item.icon ?? (
              <span className="ietm-toolbar-custom-fallback-icon" aria-hidden>
                ···
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
