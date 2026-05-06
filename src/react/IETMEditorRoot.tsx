import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { JSONContent } from '@tiptap/core'
import {
  ApplicabilityProvider,
  type ApplicabilityState,
} from './context/ApplicabilityContext'
import { IETMEditor, type IETMEditorRefValue } from './IETMEditor'

export interface IETMEditorRootHandle {
  setContent: (content: JSONContent | string) => void
  setApplicability: (next: Partial<ApplicabilityState>) => void
  setEditable: (value: boolean) => void
  getJSON: () => JSONContent
  focus: () => void
}

interface IETMEditorRootProps {
  initialContent?: JSONContent | string
  initialApplicability?: ApplicabilityState
  initialEditable: boolean
  onUpdate: (json: JSONContent) => void
  onSelectionChange: (range: { from: number; to: number }) => void
  onReady: () => void
}

export const IETMEditorRoot = forwardRef<IETMEditorRootHandle, IETMEditorRootProps>(
  function IETMEditorRoot(props, ref) {
    const [applicability, setApplicabilityState] = useState<ApplicabilityState>(
      props.initialApplicability ?? {
        activePlatform: 'A320',
        showOnlyApplicable: false,
      },
    )
    const [editable, setEditable] = useState(props.initialEditable)
    const editorRef = useRef<IETMEditorRefValue>(null)

    const ctxValue = useMemo(() => applicability, [applicability])

    useImperativeHandle(
      ref,
      () => ({
        setContent: (content) => editorRef.current?.setContent(content),
        setApplicability: (next) =>
          setApplicabilityState((prev) => ({ ...prev, ...next })),
        setEditable: (value) => setEditable(value),
        getJSON: () =>
          editorRef.current?.getJSON() ?? { type: 'doc', content: [] },
        focus: () => editorRef.current?.focus(),
      }),
      [],
    )

    return (
      <ApplicabilityProvider value={ctxValue}>
        <IETMEditor
          ref={editorRef}
          initialContent={props.initialContent}
          editable={editable}
          applicability={applicability}
          setApplicability={(next) =>
            setApplicabilityState((prev) => ({ ...prev, ...next }))
          }
          onUpdate={props.onUpdate}
          onSelectionChange={props.onSelectionChange}
          onReady={props.onReady}
        />
      </ApplicabilityProvider>
    )
  },
)
