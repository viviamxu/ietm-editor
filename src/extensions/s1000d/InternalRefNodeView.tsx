import { Popover } from "@arco-design/web-react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { ArrowRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  findInternalRefTargetById,
  navigateInternalRefTarget,
} from "../../lib/editor/internalRefNavigate";

import {
  describeInternalRefNodeType,
  describeInternalRefTargetType,
  formatInternalRefPopoverLabel,
} from "./internalRefLabels";

function resolveTypeLabel(
  irrtt: string | null | undefined,
  targetTypeName: string | null,
): string {
  if (irrtt) {
    const fromIrrtt = describeInternalRefTargetType(irrtt);
    if (fromIrrtt !== "内部引用") return fromIrrtt;
  }
  if (targetTypeName) return describeInternalRefNodeType(targetTypeName);
  return "引用";
}

function stopPointerToEditor(e: ReactMouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
}

/**
 * `internalRef` 行内 NodeView：悬浮 Popover 展示「类型：ID」，橙色箭头跳转目标。
 */
export function InternalRefNodeView(props: NodeViewProps) {
  const { editor, node } = props;

  const refId = String(node.attrs.internalRefId ?? "").trim();
  const irrtt = node.attrs.internalRefTargetType as string | undefined | null;

  const [targetTypeName, setTargetTypeName] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const meta = refId ? findInternalRefTargetById(editor, refId) : null;
      setTargetTypeName(meta?.typeName ?? null);
    };
    sync();
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor, refId]);

  const typeLabel = useMemo(
    () => resolveTypeLabel(irrtt, targetTypeName),
    [irrtt, targetTypeName],
  );

  const popoverText = formatInternalRefPopoverLabel(typeLabel, refId);

  /** 在 mousedown 阶段跳转，早于 Popover 收起后可能落到正文上的 click */
  const onJumpPointerDown = (e: ReactMouseEvent<HTMLButtonElement>) => {
    stopPointerToEditor(e);
    navigateInternalRefTarget(editor, refId);
  };

  const popupContainer = useCallback(() => {
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);

  const popoverContent = (
    <div
      className="s1000d-internal-ref-popover"
      onMouseDown={stopPointerToEditor}
      onClick={stopPointerToEditor}
    >
      <span className="s1000d-internal-ref-popover__label">{popoverText}</span>
      <button
        type="button"
        className="s1000d-internal-ref-popover__jump"
        aria-label={`跳转至引用目标：${popoverText}`}
        onMouseDown={onJumpPointerDown}
        onClick={stopPointerToEditor}
      >
        <ArrowRight size={12} aria-hidden strokeWidth={2.5} />
      </button>
    </div>
  );

  return (
    <NodeViewWrapper
      as="span"
      className="s1000d-internal-ref"
      data-internal-ref-id={refId || undefined}
      data-internal-ref-type={irrtt ?? undefined}
      contentEditable={false}
    >
      <Popover
        trigger="hover"
        position="top"
        content={popoverContent}
        getPopupContainer={popupContainer}
        className="s1000d-internal-ref-popover-shell"
        blurToHide={false}
        popupHoverStay
      >
        <span className="s1000d-internal-ref__chip">
          {refId ? (
            <span className="s1000d-internal-ref__id">{refId}</span>
          ) : (
            <span className="s1000d-internal-ref__missing">?</span>
          )}
        </span>
      </Popover>
    </NodeViewWrapper>
  );
}
