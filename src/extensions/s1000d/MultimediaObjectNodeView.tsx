import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Film } from "lucide-react";
import Cc3dSceneElement from "../../components/3d/Cc3dSceneElement";
import WebglSceneElement from "../../components/3d/WebglSceneElement";

// 让 TypeScript 认识 cc-3d-scene / cc-webgl-scene 自定义元素
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "cc-3d-scene": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          "img-src"?: string;
        },
        HTMLElement
      >;
      "cc-webgl-scene": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "webgl-url"?: string;
          "webgl-command-template"?: string;
          "webgl-command"?: string;
          "img-src"?: string;
        },
        HTMLElement
      >;
    }
  }
}

function isVideoMedia(fileType: string, mediaSrc: string): boolean {
  if (!mediaSrc) return false;
  if (fileType === "mp4" || fileType === "webm") return true;
  return /\.(mp4|webm)(\?|$)/i.test(mediaSrc);
}

function hasWebglPreview(attrs: Record<string, unknown>): boolean {
  const dataType = String(attrs.dataType ?? "").trim();
  if (dataType !== "webgl") return false;
  return (
    !!String(attrs.webglUrl ?? "").trim() ||
    !!String(attrs.webglCommandTemplate ?? "").trim() ||
    !!String(attrs.webglCommand ?? "").trim()
  );
}

/** S1000D `multimediaObject`：按 dataType / 媒体类型渲染 WebGL、3D、视频或占位。 */
export function MultimediaObjectNodeView(props: NodeViewProps) {
  const { node } = props;
  const dataType = String(node.attrs.dataType ?? "").trim();
  const fileType = String(node.attrs.fileType ?? "").trim();
  const sceneSrc = String(node.attrs.sceneSrc ?? "").trim();
  const previewImgSrc = String(node.attrs.previewImgSrc ?? "").trim();
  const mediaSrc = String(node.attrs.mediaSrc ?? "").trim();
  const webglUrl = String(node.attrs.webglUrl ?? "").trim();
  const webglCommandTemplate = String(
    node.attrs.webglCommandTemplate ?? "",
  ).trim();
  const webglCommand = String(node.attrs.webglCommand ?? "").trim();

  if (hasWebglPreview(node.attrs as Record<string, unknown>)) {
    return (
      <NodeViewWrapper
        as="div"
        className="s1000d-multimedia-object-node s1000d-multimedia-object-node--webgl"
        data-s1000d-node="multimediaObject"
        contentEditable={false}
      >
        <WebglSceneElement
          webglUrl={webglUrl || undefined}
          webglCommandTemplate={webglCommandTemplate || undefined}
          webglCommand={webglCommand || undefined}
          imgSrc={previewImgSrc || undefined}
          className="s1000d-webgl-scene"
        />
        <NodeViewContent className="s1000d-multimedia-object-node__parameters" />
      </NodeViewWrapper>
    );
  }

  const is3d =
    !!sceneSrc &&
    (dataType === "cc3d" ||
      node.attrs.multimediaType === "3D" ||
      fileType === "zip");
  if (is3d) {
    return (
      <NodeViewWrapper
        as="div"
        className="s1000d-multimedia-object-node s1000d-multimedia-object-node--3d"
        data-s1000d-node="multimediaObject"
        contentEditable={false}
      >
        <Cc3dSceneElement
          src={sceneSrc}
          imgSrc={previewImgSrc || undefined}
          className="s1000d-cc3d-scene"
        />
        <NodeViewContent className="s1000d-multimedia-object-node__parameters" />
      </NodeViewWrapper>
    );
  }

  if (isVideoMedia(fileType, mediaSrc)) {
    return (
      <NodeViewWrapper
        as="div"
        className="s1000d-multimedia-object-node s1000d-multimedia-object-node--video"
        data-s1000d-node="multimediaObject"
        contentEditable={false}
      >
        <video
          className="s1000d-multimedia-object-node__video"
          src={mediaSrc}
          poster={previewImgSrc || undefined}
          controls
          preload="metadata"
          playsInline
        />
        <NodeViewContent className="s1000d-multimedia-object-node__parameters" />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-multimedia-object-node"
      data-s1000d-node="multimediaObject"
      contentEditable={false}
    >
      <Film
        size={18}
        aria-hidden
        className="s1000d-multimedia-object-node__icon"
      />
      <span className="s1000d-multimedia-object-node__label">多媒体</span>
      <NodeViewContent className="s1000d-multimedia-object-node__parameters" />
    </NodeViewWrapper>
  );
}
