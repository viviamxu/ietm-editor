import {
  Button,
  ConfigProvider,
  Input,
  Modal,
  Pagination,
  Space,
  Table,
  Tree,
} from "@arco-design/web-react";
import type { TableColumnProps, TreeProps } from "@arco-design/web-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IETM_ARCO_PREFIX_CLS } from "../../constants/arco";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";

/** Arco 未从包根导出 TreeDataType，用 treeData 元素类型等价替代 */
type ArcoTreeDataNode = NonNullable<TreeProps["treeData"]>[number];

type MenuItem = {
  id: string;
  label: string;
  children?: MenuItem[];
};

type PublicationRow = {
  id: string;
  menuId: string;
  title: string;
  code: string;
  version: string;
  security: string;
  preview: string;
};

const MENU_TREE: MenuItem[] = [
  {
    id: "product",
    label: "产品名称",
    children: [
      {
        id: "l1-a",
        label: "一级系统 A",
        children: [
          { id: "l2-a1", label: "二级系统 A1" },
          { id: "l2-a2", label: "二级系统 A2" },
        ],
      },
      {
        id: "l1-b",
        label: "一级系统 B",
        children: [
          { id: "l2-b1", label: "二级系统 B1" },
          { id: "l2-b2", label: "二级系统 B2" },
        ],
      },
    ],
  },
];

function collectLeafIds(nodes: MenuItem[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children?.length) collectLeafIds(n.children, out);
    else out.push(n.id);
  }
  return out;
}

const LEAF_IDS = collectLeafIds(MENU_TREE);
const LEAF_ID_SET = new Set(LEAF_IDS);

function collectParentIds(nodes: MenuItem[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children?.length) {
      out.push(n.id);
      collectParentIds(n.children, out);
    }
  }
  return out;
}

const DEFAULT_EXPANDED_KEYS = collectParentIds(MENU_TREE);

function toTreeData(nodes: MenuItem[]): ArcoTreeDataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.label,
    children: n.children?.length ? toTreeData(n.children) : undefined,
  }));
}

const TREE_DATA = toTreeData(MENU_TREE);

function makeMockRows(): PublicationRow[] {
  const rows: PublicationRow[] = [];
  let n = 0;
  for (const menuId of LEAF_IDS) {
    for (let i = 1; i <= 24; i++) {
      n += 1;
      rows.push({
        id: `${menuId}-${i}`,
        menuId,
        title: `插图标题 ${menuId}-${i}`,
        code: `ICN-XXX-${String(n).padStart(6, "0")}-${String((n % 99999) + 10000).slice(0, 5)}`,
        version: String(1 + (n % 3)).padStart(3, "0"),
        security: String(1 + (n % 2)).padStart(2, "0"),
        preview: `https://picsum.photos/seed/ietm${n}/96/96`,
      });
    }
  }
  return rows;
}

const ALL_ROWS = makeMockRows();

function ReferencePublicationDialog({
  visible,
  openNonce,
}: {
  visible: boolean;
  openNonce: number;
}) {
  const editor = useInsertPublicationModalStore((s) => s.editor);
  const closeInsertPublication = useInsertPublicationModalStore(
    (s) => s.closeInsertPublication,
  );

  const [search, setSearch] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>(
    () => DEFAULT_EXPANDED_KEYS,
  );
  const [activeMenuId, setActiveMenuId] = useState(() => LEAF_IDS[0] ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 3. 重点：每次弹窗打开时，优雅地重置表单状态，而不是销毁整个组件
  useEffect(() => {
    if (visible) {
      setSearch("");
      setActiveMenuId(LEAF_IDS[0] ?? "");
      setPage(1);
      setSelectedId(null);
      setExpandedKeys(DEFAULT_EXPANDED_KEYS);
    }
  }, [visible, openNonce]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_ROWS.filter((r) => {
      if (r.menuId !== activeMenuId) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      );
    });
  }, [activeMenuId, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayPage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (displayPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, displayPage, pageSize]);

  const columns: TableColumnProps<PublicationRow>[] = useMemo(
    () => [
      { title: "标题", dataIndex: "title", width: 200 },
      { title: "编码", dataIndex: "code", width: 220 },
      { title: "版本", dataIndex: "version", width: 88 },
      { title: "密级", dataIndex: "security", width: 88 },
      {
        title: "预览",
        dataIndex: "preview",
        width: 96,
        render: (_: unknown, row: PublicationRow) => (
          <img
            src={row.preview}
            alt=""
            width={48}
            height={48}
            style={{
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid var(--color-border-2)",
            }}
          />
        ),
      },
    ],
    [],
  );

  const onTreeSelect = useCallback((keys: string[]) => {
    const key = keys[0];
    if (!key || !LEAF_ID_SET.has(key)) return;
    setActiveMenuId(key);
    setPage(1);
    setSelectedId(null);
  }, []);

  const handleConfirm = () => {
    if (!editor) {
      closeInsertPublication();
      return;
    }
    const row = ALL_ROWS.find((r) => r.id === selectedId);
    if (row) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src: row.preview,
            alt: row.title,
            figureId: row.code,
          },
        })
        .run();
    }
    closeInsertPublication();
  };

  const popupContainer = useCallback(() => {
    const el = document.getElementById("ietm-modal-portal-root");
    return (el as HTMLElement) ?? document.body;
  }, []);

  return (
    <ConfigProvider
      prefixCls={IETM_ARCO_PREFIX_CLS}
      effectGlobalNotice={false}
      effectGlobalModal={false}
      getPopupContainer={popupContainer} // 这个负责 Select, Tooltip 等内部小弹层
    >
      <Modal
        title="引用出版物"
        visible
        maskClosable={false}
        getPopupContainer={popupContainer}
        getChildrenPopupContainer={() => popupContainer()}
        onCancel={closeInsertPublication}
        style={{ width: 960 }}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Space>
              <Button onClick={closeInsertPublication}>取消</Button>
              <Button type="primary" onClick={handleConfirm}>
                确定
              </Button>
            </Space>
          </div>
        }
      >
        <div className="ietm-ref-pub-arco-body">
          <div className="ietm-ref-pub-arco-sidebar">
            <div style={{ padding: 10 }}>
              <Input.Search
                allowClear
                placeholder="输入标题/编码检索"
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                onSearch={() => setPage(1)}
              />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "0 4px 8px" }}>
              <Tree
                treeData={TREE_DATA}
                selectedKeys={[activeMenuId]}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                onSelect={onTreeSelect}
                blockNode
              />
            </div>
          </div>
          <div className="ietm-ref-pub-arco-main">
            <div className="ietm-ref-pub-arco-table-wrap">
              <Table<PublicationRow>
                rowKey="id"
                columns={columns}
                data={pageRows}
                pagination={false}
                border
                rowSelection={{
                  type: "radio",
                  selectedRowKeys: selectedId ? [selectedId] : [],
                  onChange: (keys) => {
                    setSelectedId((keys[0] as string | undefined) ?? null);
                  },
                }}
              />
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--ietm-arco-color-border-2)",
              }}
            >
              <Pagination
                showTotal
                sizeCanChange
                sizeOptions={[10, 20, 50]}
                total={filteredRows.length}
                current={displayPage}
                pageSize={pageSize}
                onChange={(p, ps) => {
                  setPageSize(ps);
                  setPage(p);
                }}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                showJumper
              />
            </div>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

export function ReferencePublicationModal() {
  const isOpen = useInsertPublicationModalStore((s) => s.isOpen);
  const openNonce = useInsertPublicationModalStore((s) => s.openNonce);

  // 删掉之前的 if (!isOpen) return null
  // 删掉之前的 key={openNonce} 暴力重置

  return createPortal(
    // 这是一个永久存在的空壳结界，专门用来接纳 Modal
    <div className="ietm-arco-root" id="ietm-modal-portal-root">
      <ReferencePublicationDialog visible={isOpen} openNonce={openNonce} />
    </div>,
    document.body,
  );
}
