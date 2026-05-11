import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { JSONContent } from "@tiptap/core";
import {
  resetDescriptionSchema,
  setDescriptionSchema,
} from "../../store/descriptionSchemaStore";
import type { DescriptionSchema } from "../../types/descriptionSchema";
import { IETMEditor, type IETMEditorRefValue } from "./IETMEditor";
import { ConfigProvider } from "@arco-design/web-react";
import { ReferencePublicationModal } from "../../extensions/s1000d/ReferencePublicationModal";
export interface IETMEditorRootHandle {
  setContent: (content: JSONContent | string) => void;
  setEditable: (value: boolean) => void;
  getJSON: () => JSONContent;
  focus: () => void;
}

interface IETMEditorRootProps {
  initialContent?: JSONContent | string;
  initialEditable: boolean;
  initialDescriptionSchema?: DescriptionSchema;
  onUpdate: (json: JSONContent) => void;
  onSelectionChange: (range: { from: number; to: number }) => void;
  onReady: () => void;
}

export const IETMEditorRoot = forwardRef<
  IETMEditorRootHandle,
  IETMEditorRootProps
>(function IETMEditorRoot(props, ref) {
  const [editable, setEditable] = useState(props.initialEditable);
  const editorRef = useRef<IETMEditorRefValue>(null);

  useEffect(() => {
    if (!props.initialDescriptionSchema) return undefined;
    setDescriptionSchema(props.initialDescriptionSchema);
    return () => {
      resetDescriptionSchema();
    };
  }, [props.initialDescriptionSchema]);

  useImperativeHandle(
    ref,
    () => ({
      setContent: (content) => editorRef.current?.setContent(content),
      setEditable: (value) => setEditable(value),
      getJSON: () =>
        editorRef.current?.getJSON() ?? { type: "doc", content: [] },
      focus: () => editorRef.current?.focus(),
    }),
    [],
  );
  // 定义所有内部浮层的安全挂载点
  const getPopupContainer = useCallback(() => {
    // 寻找我们铺设的结界，找不到就降级到 body
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);
  return (
    <div
      id="ietm-sdk-portal-root"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <ConfigProvider
        prefixCls="ietm-arco"
        getPopupContainer={getPopupContainer}
      >
        <IETMEditor
          ref={editorRef}
          initialContent={props.initialContent}
          editable={editable}
          onUpdate={props.onUpdate}
          onSelectionChange={props.onSelectionChange}
          onReady={props.onReady}
        />
        <ReferencePublicationModal />
      </ConfigProvider>
    </div>
  );
});
