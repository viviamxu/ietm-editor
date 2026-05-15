import type { TableColumnProps } from "@arco-design/web-react";
import { Button, Modal, Space, Table, Tag, Tooltip } from "@arco-design/web-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  collectInternalRefTargets,
  type InternalRefTargetRow,
} from "../../lib/editor/collectInternalRefTargets";
import { useInternalRefModalStore } from "../../store/internalRefModalStore";

const EMPTY_HINT = "暂无可用引用目标";

function InternalRefDialog() {
  const editor = useInternalRefModalStore((s) => s.editor);
  const closeInternalRef = useInternalRefModalStore((s) => s.closeInternalRef);

  const targets = useMemo(
    () => (editor ? collectInternalRefTargets(editor) : []),
    [editor],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableBodyScrollY, setTableBodyScrollY] = useState(360);

  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return undefined;

    const measure = () => {
      const h = el.clientHeight;
      if (h > 80) setTableBodyScrollY(h - 8);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [targets.length]);

  const selectedRow = useMemo(
    () => targets.find((r) => r.key === selectedKey) ?? null,
    [targets, selectedKey],
  );

  const columns = useMemo<TableColumnProps<InternalRefTargetRow>[]>(
    () => [
      {
        title: "id",
        dataIndex: "id",
        align: "left",
        width: 120,
        ellipsis: true,
      },
      {
        title: "类型",
        dataIndex: "type",
        align: "center",
        width: 140,
        render: (type: string) => (
          <Tag className="ietm-internal-ref-type-tag">{type}</Tag>
        ),
      },
      {
        title: "上下文",
        dataIndex: "context",
        align: "left",
        ellipsis: true,
        render: (context: string) => (
          <Tooltip content={context}>
            <span className="ietm-internal-ref-context-cell">{context}</span>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const handleConfirm = () => {
    if (!editor || !selectedRow) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "internalRef",
        attrs: {
          internalRefId: selectedRow.id,
        },
      })
      .run();
    closeInternalRef();
  };

  const popupContainer = useCallback(() => {
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);

  return (
    <Modal
      title="内部引用"
      visible
      maskClosable
      onCancel={closeInternalRef}
      getPopupContainer={popupContainer}
      getChildrenPopupContainer={() => popupContainer()}
      className="ietm-internal-ref-modal"
      style={{ width: 720 }}
      footer={
        <div className="ietm-internal-ref-modal__footer">
          <Space>
            <Button type="text" onClick={closeInternalRef}>
              取消
            </Button>
            <Button
              type="primary"
              disabled={!selectedRow}
              onClick={handleConfirm}
              className="ietm-internal-ref-modal__confirm"
            >
              确定
            </Button>
          </Space>
        </div>
      }
    >
      <div className="ietm-internal-ref-modal__body" ref={tableWrapRef}>
        <Table<InternalRefTargetRow>
          rowKey="key"
          columns={columns}
          data={targets}
          pagination={false}
          border
          tableLayoutFixed
          scroll={{ y: tableBodyScrollY }}
          noDataElement={<span className="ietm-internal-ref-empty">{EMPTY_HINT}</span>}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selectedKey ? [selectedKey] : [],
            onChange: (keys) => {
              const next = keys[0];
              setSelectedKey(typeof next === "string" ? next : null);
            },
          }}
          onRow={(record) => ({
            onClick: () => setSelectedKey(record.key),
          })}
        />
      </div>
    </Modal>
  );
}

export function InternalRefModal() {
  const isOpen = useInternalRefModalStore((s) => s.isOpen);
  const openNonce = useInternalRefModalStore((s) => s.openNonce);

  if (!isOpen) return null;

  return <InternalRefDialog key={openNonce} />;
}
