import { Popover } from "@arco-design/web-react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { ArrowRight } from "lucide-react";
import {
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { openExternalRefPublication } from "../../lib/editor/openExternalRef";

import { parseDmRefDisplayMeta, parseDmRefDisplayTitle } from "./dmRefDisplay";

function stopPointerToEditor(e: ReactMouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
}

/**
 * `dmRef` 行内 NodeView：正文展示标题；悬浮 Popover 展示编码；箭头由宿主打开出版物。
 */
export function DmRefNodeView(props: NodeViewProps) {
  const { editor, node } = props;
  const rawXml = String(node.attrs.rawXml ?? "");
  const displayCode = node.attrs.displayCode as string | null | undefined;
  const refTargetId = node.attrs.refTargetId as string | null | undefined;

  const meta = useMemo(
    () => parseDmRefDisplayMeta(rawXml, displayCode),
    [rawXml, displayCode],
  );

  const displayTitle = useMemo(
    () => parseDmRefDisplayTitle(rawXml, displayCode),
    [rawXml, displayCode],
  );

  const codeText = meta.code || "—";

  const onOpenPointerDown = (e: ReactMouseEvent<HTMLButtonElement>) => {
    stopPointerToEditor(e);
    openExternalRefPublication(editor, { rawXml, displayCode, refTargetId });
  };

  const popupContainer = useCallback(() => {
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);

  const popoverContent = (
    <div
      className="s1000d-internal-ref-popover s1000d-dm-ref-popover"
      onMouseDown={stopPointerToEditor}
      onClick={stopPointerToEditor}
    >
      <span className="s1000d-dm-ref-popover__code-wrap" title={codeText}>
        <span className="s1000d-dm-ref-popover__code">{codeText}</span>
      </span>
      <button
        type="button"
        className="s1000d-internal-ref-popover__jump s1000d-dm-ref-popover__jump"
        aria-label={`打开出版物：${meta.code || displayTitle}`}
        onMouseDown={onOpenPointerDown}
        onClick={stopPointerToEditor}
      >
        <ArrowRight size={12} aria-hidden strokeWidth={2.5} />
      </button>
    </div>
  );

  return (
    <NodeViewWrapper
      as="span"
      className="s1000d-dm-ref"
      data-s1000d-node="dmRef"
      contentEditable={false}
    >
      <Popover
        trigger="hover"
        position="top"
        content={popoverContent}
        getPopupContainer={popupContainer}
        className="s1000d-internal-ref-popover-shell s1000d-dm-ref-popover-shell"
        blurToHide={false}
        popupHoverStay
      >
        <span className="s1000d-dm-ref__chip" title={displayTitle}>
          <span className="s1000d-dm-ref__title">{displayTitle}</span>
        </span>
      </Popover>
    </NodeViewWrapper>
  );
}
