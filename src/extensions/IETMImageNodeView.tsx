import { useEffect, useRef } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

export function IETMImageNodeView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const titleRef = useRef<HTMLDivElement | null>(null);
  const title = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";

  useEffect(() => {
    if (
      !titleRef.current ||
      titleRef.current === document.activeElement ||
      titleRef.current.textContent === title
    ) {
      return;
    }
    titleRef.current.textContent = title;
  }, [title]);

  const commitTitle = () => {
    const nextTitle = titleRef.current?.textContent ?? "";
    if (nextTitle !== title) {
      updateAttributes({ alt: nextTitle });
    }
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`ietm-image-node${selected ? " is-selected" : ""}`}
      contentEditable={false}
    >
      <div
        ref={titleRef}
        className="ietm-image-title"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="请输入图片标题"
        onBlur={commitTitle}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            commitTitle();
            titleRef.current?.blur();
          }
        }}
      >
        {title}
      </div>
      <img
        className="ietm-image-node__image"
        src={src}
        alt={title}
        draggable={false}
      />
    </NodeViewWrapper>
  );
}
