import {
  forwardRef,
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

  return (
    <IETMEditor
      ref={editorRef}
      initialContent={props.initialContent}
      editable={editable}
      onUpdate={props.onUpdate}
      onSelectionChange={props.onSelectionChange}
      onReady={props.onReady}
    />
  );
});
