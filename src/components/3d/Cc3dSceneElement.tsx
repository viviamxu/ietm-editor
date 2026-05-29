import { useEffect, useRef } from "react";

interface Cc3dSceneElementProps {
  src: string;
  imgSrc?: string;
  className?: string;
}

/**
 * 规避 React 19 对 custom element 只读属性赋值导致的 TypeError。
 */
export default function Cc3dSceneElement(props: Cc3dSceneElementProps) {
  const { src, imgSrc, className } = props;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const nextSrc = String(src ?? "").trim();
    if (nextSrc) el.setAttribute("src", nextSrc);
    else el.removeAttribute("src");

    const nextImg = String(imgSrc ?? "").trim();
    if (nextImg) el.setAttribute("img-src", nextImg);
    else el.removeAttribute("img-src");
  }, [src, imgSrc]);

  // @ts-expect-error cc-3d-scene 是自定义元素
  return <cc-3d-scene ref={ref} class={className} />;
}
