import { useEffect, useRef } from "react";

interface WebglSceneElementProps {
  webglUrl?: string;
  webglCommandTemplate?: string;
  webglCommand?: string;
  imgSrc?: string;
  className?: string;
}

/**
 * 规避 React 19 对 custom element 只读属性赋值导致的 TypeError。
 * 宿主需注册 `cc-webgl-scene`（或等价 Web Component）以完成交互预览。
 */
export default function WebglSceneElement(props: WebglSceneElementProps) {
  const { webglUrl, webglCommandTemplate, webglCommand, imgSrc, className } =
    props;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setOrRemove = (name: string, value: string | undefined) => {
      const next = String(value ?? "").trim();
      if (next) el.setAttribute(name, next);
      else el.removeAttribute(name);
    };

    setOrRemove("webgl-url", webglUrl);
    setOrRemove("webgl-command-template", webglCommandTemplate);
    setOrRemove("webgl-command", webglCommand);
    setOrRemove("img-src", imgSrc);
  }, [webglUrl, webglCommandTemplate, webglCommand, imgSrc]);

  // @ts-expect-error cc-webgl-scene 是自定义元素
  return <cc-webgl-scene ref={ref} class={className} />;
}
