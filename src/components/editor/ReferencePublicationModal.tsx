import type { TableColumnProps, TreeProps } from "@arco-design/web-react";
import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Space,
  Table,
  Tree,
} from "@arco-design/web-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { insertImagesIntoEditor } from "../../lib/editor/insertImages";
import { deferEditorMutation } from "../../lib/editor/deferEditorMutation";
import { insertMultimediaIntoEditor } from "../../lib/editor/insertMultimedia";
import { insertSymbolIntoEditor } from "../../lib/editor/insertSymbols";
import { fetchIcnInfoList } from "../../lib/ietm/icnInfo";
import {
  icnInfoRowToPublicationRow,
  publicationRowMatchesMode,
  type PublicationRow,
} from "../../lib/ietm/icnPublicationRow";
import { DEMO_IPD_HOTSPOT_SVG, DEMO_MULTIMEDIA_MP4 } from "../../lib/ietm/multimediaIcnHydrate";
import { mockPublicationPreviewDataUrl } from "../../lib/ietm/mockPublicationPreview";
import { useIcnInfoStore } from "../../store/icnInfoStore";
import { useInsertPublicationModalStore } from "../../store/insertPublicationModalStore";
import type { InsertPublicationMode } from "../../store/insertPublicationModalStore";
import { getDescriptionSchema } from "../../store/descriptionSchemaStore";

type ArcoTreeDataNode = NonNullable<TreeProps["treeData"]>[number];

type MenuItem = {
  id: string;
  label: string;
  children?: MenuItem[];
};

/** 弹框列表 mock 行（未配置 `apiBaseUrl` 时使用） */
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
      const isVideo = n % 3 === 0;
      const isHotspotSvgDemo = n === 1;
      const poster = isHotspotSvgDemo
        ? DEMO_IPD_HOTSPOT_SVG
        : mockPublicationPreviewDataUrl(n);
      rows.push({
        id: `${menuId}-${i}`,
        menuId,
        title: isVideo
          ? `演示视频 ${menuId}-${i}`
          : isHotspotSvgDemo
            ? "图解热点 SVG（绘图.svg）"
            : `插图标题 ${menuId}-${i}`,
        code: isHotspotSvgDemo
          ? "ICN-DEMO-HOTSPOT-SVG"
          : `ICN-XXX-${String(n).padStart(6, "0")}-${String((n % 99999) + 10000).slice(0, 5)}`,
        version: String(1 + (n % 3)).padStart(3, "0"),
        security: String(1 + (n % 2)).padStart(2, "0"),
        preview: poster,
        dataType: null,
        fileType: isVideo ? "mp4" : isHotspotSvgDemo ? "svg" : null,
        filePath: isVideo
          ? DEMO_MULTIMEDIA_MP4
          : isHotspotSvgDemo
            ? DEMO_IPD_HOTSPOT_SVG
            : undefined,
        thPath: poster,
      });
    }
  }
  return rows;
}

const ALL_ROWS = makeMockRows();

// ─── 统一图片 / 多媒体列表对话框 ─────────────────────────────────────────────

function ReferencePublicationDialog(props: { mode: InsertPublicationMode }) {
  const { mode } = props;
  const isMultimedia = mode === "multimedia";
  const isSymbol = mode === "symbol";

  const apiBaseUrl = useIcnInfoStore((s) => s.apiBaseUrl);
  const icnInfoPath = useIcnInfoStore((s) => s.icnInfoPath);
  const useRemoteIcn = !!apiBaseUrl.trim();

  const editor = useInsertPublicationModalStore((s) => s.editor);
  const closeInsertPublication = useInsertPublicationModalStore(
    (s) => s.closeInsertPublication,
  );

  const [search, setSearch] = useState("");
  const [activeMenuId, setActiveMenuId] = useState(() => LEAF_IDS[0] ?? "");
  const [expandedKeys, setExpandedKeys] = useState<string[]>(
    DEFAULT_EXPANDED_KEYS,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<PublicationRow[]>([]);
  const [remoteRows, setRemoteRows] = useState<PublicationRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableBodyScrollY, setTableBodyScrollY] = useState(400);

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

  useEffect(() => {
    if (!useRemoteIcn) return undefined;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    void fetchIcnInfoList({
      apiBaseUrl,
      path: icnInfoPath,
      page,
      pageSize,
      keyword: search.trim() || undefined,
    })
      .then(({ list, total }) => {
        if (cancelled) return;
        const rows = list
          .map(icnInfoRowToPublicationRow)
          .filter((row) => publicationRowMatchesMode(row, mode));
        setRemoteRows(rows);
        setRemoteTotal(total);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : String(err));
        setRemoteRows([]);
        setRemoteTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useRemoteIcn, apiBaseUrl, icnInfoPath, page, pageSize, search, mode]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectedRows([]);
  }, [page, pageSize, search, activeMenuId, mode, useRemoteIcn]);

  const mockFilteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_ROWS.filter((r) => {
      if (r.menuId !== activeMenuId) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      );
    });
  }, [activeMenuId, search]);

  const listTotal = useRemoteIcn ? remoteTotal : mockFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const displayPage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    if (useRemoteIcn) return remoteRows;
    const start = (displayPage - 1) * pageSize;
    return mockFilteredRows.slice(start, start + pageSize);
  }, [useRemoteIcn, remoteRows, mockFilteredRows, displayPage, pageSize]);

  const columns: TableColumnProps<PublicationRow>[] = useMemo(
    () => [
      { title: "标题", dataIndex: "title" },
      { title: "编码", dataIndex: "code", width: 200 },
      { title: "版本", dataIndex: "version", width: 80 },
      { title: "密级", dataIndex: "security", width: 80 },
      ...(isMultimedia
        ? [
            {
              title: "类型",
              dataIndex: "fileType",
              width: 72,
              render: (_: unknown, row: PublicationRow) => {
                if (row.fileType === "mp4") {
                  return (
                    <span style={{ color: "#2563eb", fontWeight: 500 }}>
                      视频
                    </span>
                  );
                }
                return <span style={{ color: "#64748b" }}>其它</span>;
              },
            } satisfies TableColumnProps<PublicationRow>,
          ]
        : []),
      {
        title: "预览",
        dataIndex: "preview",
        width: 100,
        render: (_: unknown, row: PublicationRow) => (
          <img
            className="ietm-ref-pub-arco-preview"
            src={row.thPath ?? row.preview}
            alt=""
            width={48}
            height={48}
          />
        ),
      },
    ],
    [isMultimedia],
  );

  const onTreeSelect = useCallback((keys: string[]) => {
    const key = keys[0];
    if (!key || !LEAF_ID_SET.has(key)) return;
    setActiveMenuId(key);
    setPage(1);
    setSelectedIds([]);
  }, []);

  const handleConfirm = () => {
    const ed = editor;
    const fmftInsertIntent =
      useInsertPublicationModalStore.getState().fmftInsertIntent;
    const attentionBlockPos =
      useInsertPublicationModalStore.getState().attentionBlockPos;
    if (!ed) {
      closeInsertPublication();
      return;
    }
    const rows = selectedRows;

    closeInsertPublication();

    if (rows.length === 0) return;

    deferEditorMutation(() => {
      if (isMultimedia) {
        insertMultimediaIntoEditor(
          ed,
          rows.map((row) => ({
            infoEntityIdent: row.code,
            title: row.title,
            dataType: row.dataType ?? null,
            fileType: row.fileType ?? null,
            mediaSrc:
              row.fileType === "mp4" && row.filePath ? row.filePath : undefined,
            previewImgSrc: row.thPath ?? row.preview,
          })),
        );
      } else if (isSymbol) {
        const row = rows[0];
        insertSymbolIntoEditor(
          ed,
          {
            src:
              row.fileType === "svg" && row.filePath?.trim()
                ? row.filePath
                : row.preview,
            alt: row.title,
            figureId: row.code,
          },
          {
            schema: getDescriptionSchema(),
            attentionBlockPos: attentionBlockPos ?? undefined,
          },
        );
      } else {
        insertImagesIntoEditor(
          ed,
          rows.map((row) => ({
            src:
              row.fileType === "svg" && row.filePath?.trim()
                ? row.filePath
                : row.preview,
            alt: row.title,
            figureId: row.code,
          })),
          { fmftInsertIntent },
        );
      }
    });
  };

  const popupContainer = useCallback(() => {
    return document.getElementById("ietm-sdk-portal-root") || document.body;
  }, []);

  return (
    <Modal
      title={
        isMultimedia ? "插入多媒体" : isSymbol ? "插入符号" : "插入图片"
      }
      visible
      maskClosable={false}
      onCancel={closeInsertPublication}
      getPopupContainer={popupContainer}
      getChildrenPopupContainer={() => popupContainer()}
      style={{ width: 960 }}
      footer={
        <div className="ietm-ref-pub-arco-footer">
          <Space>
            <Button onClick={closeInsertPublication}>取消</Button>
            <Button
              type="primary"
              onClick={handleConfirm}
              className="!bg-[#ff8f1f] !text-[#fff] !border-[#ff8f1f]"
            >
              确定
            </Button>
          </Space>
        </div>
      }
    >
      <div className="ietm-ref-pub-arco-body">
        <div
          className={
            useRemoteIcn
              ? "ietm-ref-pub-arco-sidebar ietm-ref-pub-arco-sidebar--remote"
              : "ietm-ref-pub-arco-sidebar"
          }
        >
          <div className="ietm-ref-pub-arco-search">
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
          {!useRemoteIcn ? (
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
          ) : null}
        </div>
        <div className="ietm-ref-pub-arco-main">
          {fetchError ? (
            <div className="ietm-ref-pub-arco-error">{fetchError}</div>
          ) : null}
          <div className="ietm-ref-pub-arco-table-wrap" ref={tableWrapRef}>
            <Table<PublicationRow>
              rowKey="id"
              columns={columns}
              data={pageRows}
              loading={useRemoteIcn && loading}
              pagination={false}
              border
              tableLayoutFixed
              scroll={{ y: tableBodyScrollY }}
              noDataElement={<Empty description="当前分类下无匹配数据" />}
              rowSelection={{
                type: isSymbol ? "radio" : "checkbox",
                selectedRowKeys: selectedIds,
                onChange: (keys) => {
                  const nextIds = keys as string[];
                  setSelectedIds(nextIds);
                  const lookup = useRemoteIcn ? remoteRows : ALL_ROWS;
                  setSelectedRows(
                    nextIds
                      .map((id) => lookup.find((r) => r.id === id))
                      .filter((r): r is PublicationRow => r != null),
                  );
                },
              }}
            />
          </div>
          <div className="ietm-ref-pub-arco-pagination">
            <Pagination
              showTotal
              sizeCanChange
              sizeOptions={[10, 20, 50]}
              total={listTotal}
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

export function ReferencePublicationModal() {
  const isOpen = useInsertPublicationModalStore((s) => s.isOpen);
  const openNonce = useInsertPublicationModalStore((s) => s.openNonce);
  const mode = useInsertPublicationModalStore((s) => s.mode);

  if (!isOpen) return null;

  return <ReferencePublicationDialog key={openNonce} mode={mode} />;
}
