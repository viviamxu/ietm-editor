import type { Node as PMNode } from "@tiptap/pm/model";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

export type AttentionSymbolDisplay = {
  src: string;
  infoEntityIdent: string;
};

export function readFirstAttentionSymbolFromBlock(
  node: PMNode,
): AttentionSymbolDisplay | null {
  let result: AttentionSymbolDisplay | null = null;
  node.forEach((child) => {
    if (result || child.type.name !== "attentionSymbol") return;
    const src =
      typeof child.attrs.src === "string" ? child.attrs.src.trim() : "";
    const infoEntityIdent = String(child.attrs.infoEntityIdent ?? "").trim();
    result = { src, infoEntityIdent };
  });
  return result;
}

export function AttentionBlockSymbolIconButton(props: {
  readOnly: boolean;
  symbol: AttentionSymbolDisplay | null;
  ariaLabelInsert: string;
  ariaLabelReplace: string;
  onPick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  defaultIcon: ReactNode;
}) {
  const { readOnly, symbol, ariaLabelInsert, ariaLabelReplace, onPick, defaultIcon } =
    props;
  const hasSymbol = Boolean(symbol?.src || symbol?.infoEntityIdent);

  return (
    <button
      type="button"
      className="s1000d-attention-block__default-icon-btn"
      contentEditable={false}
      tabIndex={readOnly ? -1 : 0}
      disabled={readOnly}
      aria-label={hasSymbol ? ariaLabelReplace : ariaLabelInsert}
      title={readOnly ? undefined : hasSymbol ? "点击更换符号" : "插入符号"}
      onMouseDown={onPick}
    >
      {hasSymbol ? (
        <img
          className={
            symbol?.src
              ? "s1000d-symbol-img s1000d-symbol-img--block"
              : "s1000d-symbol-img s1000d-symbol-img--block s1000d-symbol-img--empty"
          }
          src={symbol?.src || ""}
          alt={symbol?.infoEntityIdent || "symbol"}
          draggable={false}
        />
      ) : (
        <span className="s1000d-attention-lead__icon">{defaultIcon}</span>
      )}
    </button>
  );
}
