import type { TableColumnProps, TreeProps } from "@arco-design/web-react";
import {
  Button,
  Empty,
  Input,
  Message,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
} from "@arco-design/web-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  buildMockDmRefRawXml,
  type MockExternalRefPublicationRow,
} from "../../lib/editor/buildMockDmRefXml";
import {
  canInsertDmRefIntoEditor,
  insertDmRefsIntoEditor,
} from "../../lib/editor/insertDmRefs";
import { deferEditorMutation } from "../../lib/editor/deferEditorMutation";
import { useExternalRefModalStore } from "../../store/externalRefModalStore";

type ArcoTreeDataNode = NonNullable<TreeProps["treeData"]>[number];

type MenuItem = {
  id: string;
  label: string;
  children?: MenuItem[];
};

type ExternalRefRow = MockExternalRefPublicationRow & {
  id: string;
  menuId: string;
  status: string;
  volumeNo: string;
  issueNo: string;
  languageLabel: string;
  versionPolicy: string;
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

const CSDB_OPTIONS = [
  { label: "XXXXX", value: "XXXXX" },
  { label: "S1000DBIKE", value: "S1000DBIKE" },
];

const VERSION_POLICY_OPTIONS = [
  { label: "默认最新版本", value: "latest" },
  { label: "指定版本", value: "fixed" },
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

function findMenuNode(
  id: string,
  nodes: MenuItem[] = MENU_TREE,
): MenuItem | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findMenuNode(id, n.children);
      if (found) return found;
    }
  }
  return null;
}

function collectDescendantLeafIds(menuId: string): string[] {
  const node = findMenuNode(menuId);
  if (!node) return [];
  return collectLeafIds([node]);
}

function makeMockRows(): ExternalRefRow[] {
  const rows: ExternalRefRow[] = [];
  let n = 0;
  for (const menuId of LEAF_IDS) {
    for (let i = 1; i <= 24; i++) {
      n += 1;
      rows.push({
        id: `${menuId}-${i}`,
        menuId,
        title: "出版物标题",
        status: "检出: admin",
        volumeNo: "01A03",
        issueNo: "00",
        languageLabel: "简体中文 (zh-CN)",
        languageIsoCode: "zh",
        countryIsoCode: "CN",
        version: `00${1 + (n % 3)}-00`,
        code: `PMC-XXX-XXXXX-XXXXX-XXXXX-XXXXX-${String(n).padStart(4, "0")}`,
        versionPolicy: "latest",
        techName: "数据模块",
      });
    }
  }
  return rows;
}

const ALL_ROWS = makeMockRows();

function ExternalRefPublicationDialog() {
  const editor = useExternalRefModalStore((s) => s.editor);
  const closeExternalRef = useExternalRefModalStore((s) => s.closeExternalRef);

  const [csdb, setCsdb] = useState("XXXXX");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [includeSubLevels, setIncludeSubLevels] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState({
    title: "",
    code: "",
    language: "",
    status: "",
  });

  const [treeSearch, setTreeSearch] = useState("");
  const [activeMenuId, setActiveMenuId] = useState("product");
  const [expandedKeys, setExpandedKeys] = useState<string[]>(
    DEFAULT_EXPANDED_KEYS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [versionPolicies, setVersionPolicies] = useState<
    Record<string, string>
  >({});

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableBodyScrollY, setTableBodyScrollY] = useState(360);

  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      setTableBodyScrollY(Math.max(120, Math.floor(h - 44)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeMenuLeafIds = useMemo(() => {
    if (includeSubLevels || !LEAF_ID_SET.has(activeMenuId)) {
      return collectDescendantLeafIds(activeMenuId);
    }
    return [activeMenuId];
  }, [activeMenuId, includeSubLevels]);

  const filteredRows = useMemo(() => {
    const menuSet = new Set(activeMenuLeafIds);
    const qTree = treeSearch.trim().toLowerCase();
    const qTitle = appliedFilters.title.trim().toLowerCase();
    const qCode = appliedFilters.code.trim().toLowerCase();
    const qLang = appliedFilters.language.trim().toLowerCase();
    const qStatus = appliedFilters.status.trim().toLowerCase();

    return ALL_ROWS.filter((r) => {
      if (!menuSet.has(r.menuId)) return false;
      if (
        qTree &&
        !r.title.toLowerCase().includes(qTree) &&
        !r.code.toLowerCase().includes(qTree)
      ) {
        return false;
      }
      if (qTitle && !r.title.toLowerCase().includes(qTitle)) return false;
      if (qCode && !r.code.toLowerCase().includes(qCode)) return false;
      if (qLang && !r.languageLabel.toLowerCase().includes(qLang)) return false;
      if (qStatus && !r.status.toLowerCase().includes(qStatus)) return false;
      return true;
    });
  }, [activeMenuLeafIds, appliedFilters, treeSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayPage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (displayPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, displayPage, pageSize]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({
      title: filterTitle,
      code: filterCode,
      language: filterLanguage,
      status: filterStatus,
    });
    setPage(1);
    setSelectedRowId(null);
  }, [filterCode, filterLanguage, filterStatus, filterTitle]);

  const resetFilters = useCallback(() => {
    setFilterTitle("");
    setFilterCode("");
    setFilterLanguage("");
    setFilterStatus("");
    setAppliedFilters({ title: "", code: "", language: "", status: "" });
    setCsdb("XXXXX");
    setIncludeSubLevels(true);
    setPage(1);
    setSelectedRowId(null);
  }, []);

  const columns: TableColumnProps<ExternalRefRow>[] = useMemo(
    () => [
      { title: "标题", dataIndex: "title", width: 120 },
      {
        title: "状态",
        dataIndex: "status",
        width: 110,
        render: (v: string) => (
          <Tag className="ietm-ext-ref-pub-status-tag">{v}</Tag>
        ),
      },
      { title: "册号", dataIndex: "volumeNo", width: 72 },
      { title: "卷号", dataIndex: "issueNo", width: 56 },
      {
        title: "语言",
        dataIndex: "languageLabel",
        width: 140,
        render: (v: string) => (
          <Tag className="ietm-ext-ref-pub-lang-tag">{v}</Tag>
        ),
      },
      { title: "版本", dataIndex: "version", width: 80 },
      { title: "编码", dataIndex: "code", ellipsis: true },
      {
        title: "操作",
        dataIndex: "versionPolicy",
        width: 160,
        render: (_: unknown, row: ExternalRefRow) => (
          <Select
            size="small"
            className="ietm-ext-ref-pub-version-select"
            options={VERSION_POLICY_OPTIONS}
            value={versionPolicies[row.id] ?? row.versionPolicy}
            onChange={(v) => {
              setVersionPolicies((prev) => ({
                ...prev,
                [row.id]: String(v),
              }));
            }}
          />
        ),
      },
    ],
    [versionPolicies],
  );

  const onTreeSelect = useCallback((keys: string[]) => {
    const key = keys[0];
    if (!key) return;
    setActiveMenuId(key);
    setPage(1);
    setSelectedRowId(null);
  }, []);

  const handleConfirm = () => {
    const ed = editor;
    if (!ed) {
      closeExternalRef();
      return;
    }
    const row = selectedRowId
      ? ALL_ROWS.find((r) => r.id === selectedRowId)
      : undefined;
    if (!row) {
      Message.warning("请选择一条出版物");
      return;
    }
    const rawXml = buildMockDmRefRawXml(row);
    if (!canInsertDmRefIntoEditor(ed, { rawXml })) {
      Message.warning("当前光标位置不能插入外部引用");
      return;
    }
    const payload = [{ rawXml, displayCode: row.code }] as const;
    closeExternalRef();
    deferEditorMutation(() => {
      insertDmRefsIntoEditor(ed, [...payload]);
    });
  };

  const popupContainer = useCallback(() => {
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);

  return (
    <Modal
      title="引用出版物"
      visible
      maskClosable={false}
      onCancel={closeExternalRef}
      getPopupContainer={popupContainer}
      getChildrenPopupContainer={() => popupContainer()}
      style={{ width: 1120 }}
      className="ietm-ext-ref-pub-modal"
      footer={
        <div className="ietm-ext-ref-pub-arco-footer">
          <Space>
            <Button onClick={closeExternalRef}>取消</Button>
            <Button
              type="primary"
              className="ietm-ext-ref-pub-arco-confirm"
              onClick={handleConfirm}
            >
              确定
            </Button>
          </Space>
        </div>
      }
    >
      <div className="ietm-ext-ref-pub-filters">
        <label className="ietm-ext-ref-pub-filters__field">
          <span>CSDB</span>
          <Select
            size="small"
            options={CSDB_OPTIONS}
            value={csdb}
            onChange={(v) => setCsdb(String(v))}
          />
        </label>
        <label className="ietm-ext-ref-pub-filters__field ietm-ext-ref-pub-filters__field--wide">
          <span>标题</span>
          <Input
            size="small"
            value={filterTitle}
            onChange={setFilterTitle}
            allowClear
          />
        </label>
        <label className="ietm-ext-ref-pub-filters__field ietm-ext-ref-pub-filters__field--wide">
          <span>编码</span>
          <Input
            size="small"
            value={filterCode}
            onChange={setFilterCode}
            allowClear
          />
        </label>
        <label className="ietm-ext-ref-pub-filters__field">
          <span>语言</span>
          <Input
            size="small"
            value={filterLanguage}
            onChange={setFilterLanguage}
            allowClear
          />
        </label>
        <label className="ietm-ext-ref-pub-filters__field">
          <span>状态</span>
          <Input
            size="small"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
          />
        </label>
        <label className="ietm-ext-ref-pub-filters__field">
          <span>包含下级</span>
          <Switch
            size="small"
            checked={includeSubLevels}
            onChange={setIncludeSubLevels}
          />
        </label>
        <div className="ietm-ext-ref-pub-filters__actions">
          <Button
            type="primary"
            className="!bg-[#ff8f1f] !border-[#ff8f1f]"
            onClick={applyFilters}
          >
            检索
          </Button>
          <Button onClick={resetFilters}>重置</Button>
        </div>
      </div>

      <div className="ietm-ref-pub-arco-body">
        <div className="ietm-ref-pub-arco-sidebar">
          <div className="ietm-ref-pub-arco-search">
            <Input.Search
              allowClear
              placeholder="输入标题/编码检索"
              value={treeSearch}
              onChange={(v) => {
                setTreeSearch(v);
                setPage(1);
              }}
              onSearch={() => setPage(1)}
            />
          </div>
          <div className="ietm-ref-pub-arco-tree-wrap">
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
          <div className="ietm-ref-pub-arco-table-wrap" ref={tableWrapRef}>
            <Table<ExternalRefRow>
              rowKey="id"
              columns={columns}
              data={pageRows}
              pagination={false}
              border
              tableLayoutFixed
              scroll={{ y: tableBodyScrollY }}
              noDataElement={<Empty description="无匹配出版物" />}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedRowId ? [selectedRowId] : [],
                onChange: (keys) => {
                  setSelectedRowId((keys[0] as string) ?? null);
                },
              }}
            />
          </div>
          <div className="ietm-ref-pub-arco-pagination">
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
  );
}

export function ExternalRefPublicationModal() {
  const isOpen = useExternalRefModalStore((s) => s.isOpen);
  const openNonce = useExternalRefModalStore((s) => s.openNonce);

  if (!isOpen) return null;

  return <ExternalRefPublicationDialog key={openNonce} />;
}
