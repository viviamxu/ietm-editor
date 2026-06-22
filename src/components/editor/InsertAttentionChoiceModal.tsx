import { Button, Modal, Radio, Space } from "@arco-design/web-react";
import { useEffect, useMemo, useState } from "react";

import { insertAttentionAfterBlock } from "../../lib/editor/insertAttentionAfterBlock";
import {
  buildInsertCautionJson,
  buildInsertNoteJson,
  buildInsertWarningJson,
} from "../../lib/s1000d/descriptionSchemaInsert";
import { insertSafetyRqmtsFromNoPlaceholderWithBlock } from "../../lib/s1000d/procedureInsert";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import {
  type AttentionChoiceKind,
  useInsertAttentionChoiceModalStore,
} from "../../store/insertAttentionChoiceModalStore";

const CHOICE_OPTIONS: { value: AttentionChoiceKind; label: string }[] = [
  { value: "warning", label: "添加警告" },
  { value: "caution", label: "添加注意" },
  { value: "note", label: "添加注" },
];

function buildNodeForChoice(kind: AttentionChoiceKind) {
  const schema = getDescriptionSchema();
  switch (kind) {
    case "warning":
      return buildInsertWarningJson(schema);
    case "caution":
      return buildInsertCautionJson(schema);
    case "note":
      return buildInsertNoteJson(schema);
  }
}

function InsertAttentionChoiceDialog() {
  const editor = useInsertAttentionChoiceModalStore((s) => s.editor);
  const intent = useInsertAttentionChoiceModalStore((s) => s.intent);
  const close = useInsertAttentionChoiceModalStore(
    (s) => s.closeInsertAttentionChoice,
  );

  const schema = getDescriptionSchema();
  const availableChoices = useMemo(
    () =>
      CHOICE_OPTIONS.filter((opt) => buildNodeForChoice(opt.value) != null),
    [schema],
  );

  const [choice, setChoice] = useState<AttentionChoiceKind>("warning");

  useEffect(() => {
    const first = availableChoices[0]?.value;
    if (first) setChoice(first);
  }, [availableChoices]);

  const handleConfirm = () => {
    if (editor == null || intent == null) {
      close();
      return;
    }
    const node = buildNodeForChoice(choice);
    if (node) {
      if (intent.mode === "afterBlock") {
        insertAttentionAfterBlock(editor, intent.afterBlockPos, node);
      } else {
        insertSafetyRqmtsFromNoPlaceholderWithBlock(
          editor,
          intent.reqSafetyPos,
          node,
        );
      }
    }
    close();
  };

  return (
    <Modal
      title="插入内容"
      visible
      onCancel={close}
      footer={
        <Space>
          <Button onClick={close}>取消</Button>
          <Button
            type="primary"
            disabled={availableChoices.length === 0}
            onClick={handleConfirm}
          >
            确定
          </Button>
        </Space>
      }
      autoFocus={false}
      focusLock
    >
      <Radio.Group
        direction="vertical"
        value={choice}
        onChange={(v) => setChoice(v as AttentionChoiceKind)}
      >
        {availableChoices.map((opt) => (
          <Radio key={opt.value} value={opt.value}>
            {opt.label}
          </Radio>
        ))}
      </Radio.Group>
    </Modal>
  );
}

export function InsertAttentionChoiceModal() {
  const isOpen = useInsertAttentionChoiceModalStore((s) => s.isOpen);
  const openNonce = useInsertAttentionChoiceModalStore((s) => s.openNonce);
  if (!isOpen) return null;
  return <InsertAttentionChoiceDialog key={openNonce} />;
}
