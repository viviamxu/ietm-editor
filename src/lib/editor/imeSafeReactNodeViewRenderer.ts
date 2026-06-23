import type { ReactNodeViewRendererOptions, ReactNodeViewProps } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { ComponentType } from "react";

import { isImeComposingActive } from "./imeComposition";

export function imeSafeReactNodeViewOptions(
  options: Partial<ReactNodeViewRendererOptions> = {},
): Partial<ReactNodeViewRendererOptions> {
  const userUpdate = options.update ?? null;

  return {
    ...options,
    update(props) {
      if (isImeComposingActive()) {
        return true;
      }
      if (userUpdate) {
        return userUpdate(props);
      }
      props.updateProps();
      return true;
    },
  };
}

/** 组合输入期间跳过 React NodeView 重绘，避免 IME 被打断。 */
export function imeSafeReactNodeViewRenderer(
  component: ComponentType<ReactNodeViewProps>,
  options?: Partial<ReactNodeViewRendererOptions>,
) {
  return ReactNodeViewRenderer(component, imeSafeReactNodeViewOptions(options));
}
