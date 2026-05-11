import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { useInsertPublicationModalStore } from '../../store/insertPublicationModalStore'

type MenuItem = {
  id: string
  label: string
  children?: MenuItem[]
}

type PublicationRow = {
  id: string
  menuId: string
  title: string
  code: string
  version: string
  security: string
  preview: string
}

/** 左侧树：与截图类似的层级（演示数据） */
const MENU_TREE: MenuItem[] = [
  {
    id: 'product',
    label: '产品名称',
    children: [
      {
        id: 'l1-a',
        label: '一级系统 A',
        children: [
          { id: 'l2-a1', label: '二级系统 A1' },
          { id: 'l2-a2', label: '二级系统 A2' },
        ],
      },
      {
        id: 'l1-b',
        label: '一级系统 B',
        children: [
          { id: 'l2-b1', label: '二级系统 B1' },
          { id: 'l2-b2', label: '二级系统 B2' },
        ],
      },
    ],
  },
]

function collectLeafIds(nodes: MenuItem[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.children?.length) collectLeafIds(n.children, out)
    else out.push(n.id)
  }
  return out
}

const LEAF_IDS = collectLeafIds(MENU_TREE)

function makeMockRows(): PublicationRow[] {
  const rows: PublicationRow[] = []
  let n = 0
  for (const menuId of LEAF_IDS) {
    for (let i = 1; i <= 24; i++) {
      n += 1
      rows.push({
        id: `${menuId}-${i}`,
        menuId,
        title: `插图标题 ${menuId}-${i}`,
        code: `ICN-XXX-${String(n).padStart(6, '0')}-${String((n % 99999) + 10000).slice(0, 5)}`,
        version: String(1 + (n % 3)).padStart(3, '0'),
        security: String(1 + (n % 2)).padStart(2, '0'),
        preview: `https://picsum.photos/seed/ietm${n}/96/96`,
      })
    }
  }
  return rows
}

const ALL_ROWS = makeMockRows()

function TreeRows(props: {
  nodes: MenuItem[]
  depth: number
  expanded: Set<string>
  toggle: (id: string) => void
  activeId: string
  onSelectLeaf: (id: string) => void
}) {
  const { nodes, depth, expanded, toggle, activeId, onSelectLeaf } = props
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length)
        const isOpen = expanded.has(node.id)
        const isLeaf = !hasChildren
        const isActive = activeId === node.id

        return (
          <div key={node.id} className="ietm-ref-pub-tree__node">
            <div
              className={`ietm-ref-pub-tree__row ${isActive ? 'is-active' : ''}`}
              style={{ paddingLeft: 12 + depth * 14 }}
              role="treeitem"
              aria-expanded={hasChildren ? isOpen : undefined}
              onClick={() => {
                if (isLeaf) onSelectLeaf(node.id)
                else toggle(node.id)
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="ietm-ref-pub-tree__toggle"
                  aria-label={isOpen ? '折叠' : '展开'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(node.id)
                  }}
                >
                  {isOpen ? '▼' : '▶'}
                </button>
              ) : (
                <span className="ietm-ref-pub-tree__toggle" aria-hidden />
              )}
              <span className="ietm-ref-pub-tree__label">{node.label}</span>
            </div>
            {hasChildren && isOpen ? (
              <TreeRows
                nodes={node.children!}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                activeId={activeId}
                onSelectLeaf={onSelectLeaf}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function defaultExpandedIds(nodes: MenuItem[]): Set<string> {
  const s = new Set<string>()
  const walk = (list: MenuItem[]) => {
    for (const n of list) {
      if (n.children?.length) {
        s.add(n.id)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return s
}

function ReferencePublicationDialog() {
  const editor = useInsertPublicationModalStore((s) => s.editor)
  const closeInsertPublication = useInsertPublicationModalStore(
    (s) => s.closeInsertPublication,
  )

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => defaultExpandedIds(MENU_TREE))
  const [activeMenuId, setActiveMenuId] = useState(() => LEAF_IDS[0] ?? '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [jumpInput, setJumpInput] = useState('')

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onSelectLeaf = useCallback((id: string) => {
    setActiveMenuId(id)
    setPage(1)
    setSelectedId(null)
  }, [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ALL_ROWS.filter((r) => {
      if (r.menuId !== activeMenuId) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      )
    })
  }, [activeMenuId, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const displayPage = Math.min(Math.max(1, page), totalPages)

  const pageRows = useMemo(() => {
    const start = (displayPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, displayPage, pageSize])

  const pageButtons = useMemo(() => {
    const maxBtn = 5
    let start = Math.max(1, displayPage - 2)
    const end = Math.min(totalPages, start + maxBtn - 1)
    start = Math.max(1, end - maxBtn + 1)
    const arr: number[] = []
    for (let i = start; i <= end; i++) arr.push(i)
    return arr
  }, [displayPage, totalPages])

  const handleConfirm = () => {
    if (!editor) {
      closeInsertPublication()
      return
    }
    const row = ALL_ROWS.find((r) => r.id === selectedId)
    if (row) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: {
            src: row.preview,
            alt: row.title,
            figureId: row.code,
          },
        })
        .run()
    }
    closeInsertPublication()
  }

  return (
    <div
      className="ietm-ref-pub-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeInsertPublication()
      }}
    >
      <div
        className="ietm-ref-pub-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ietm-ref-pub-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ietm-ref-pub-dialog__head" id="ietm-ref-pub-title">
          引用出版物
        </div>
        <div className="ietm-ref-pub-dialog__body">
          <aside className="ietm-ref-pub-sidebar" aria-label="分类">
            <div className="ietm-ref-pub-search">
              <input
                type="search"
                placeholder="输入标题/编码检索"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                aria-label="输入标题或编码检索"
              />
            </div>
            <nav className="ietm-ref-pub-tree" role="tree">
              <TreeRows
                nodes={MENU_TREE}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                activeId={activeMenuId}
                onSelectLeaf={onSelectLeaf}
              />
            </nav>
          </aside>
          <div className="ietm-ref-pub-main">
            <div className="ietm-ref-pub-table-wrap">
              <table className="ietm-ref-pub-table">
                <thead>
                  <tr>
                    <th
                      className="ietm-ref-pub-table__check"
                      scope="col"
                      aria-label="选择"
                    />
                    <th scope="col">标题</th>
                    <th scope="col">编码</th>
                    <th scope="col">版本</th>
                    <th scope="col">密级</th>
                    <th scope="col">预览</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="ietm-ref-pub-table__check">
                        <input
                          type="radio"
                          name="ietm-ref-pub-pick"
                          checked={selectedId === row.id}
                          onChange={() => setSelectedId(row.id)}
                          aria-label={`选择 ${row.title}`}
                        />
                      </td>
                      <td>{row.title}</td>
                      <td>{row.code}</td>
                      <td>{row.version}</td>
                      <td>{row.security}</td>
                      <td>
                        <img
                          className="ietm-ref-pub-preview"
                          src={row.preview}
                          alt=""
                          loading="lazy"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pageRows.length === 0 ? (
                <p
                  style={{
                    padding: '24px 12px',
                    color: '#6b7280',
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  当前分类下无匹配数据
                </p>
              ) : null}
            </div>
            <div className="ietm-ref-pub-pagination">
              <label>
                每页{' '}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  aria-label="每页条数"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      每页 {n} 条
                    </option>
                  ))}
                </select>
              </label>
              <div className="ietm-ref-pub-pagination__pages" role="navigation">
                {pageButtons.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === displayPage ? 'is-current' : ''}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <label className="ietm-ref-pub-pagination__jump">
                跳转至
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumpInput}
                  placeholder={String(displayPage)}
                  onChange={(e) => setJumpInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const n = Number.parseInt(jumpInput, 10)
                    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
                      setPage(n)
                      setJumpInput('')
                    }
                  }}
                  aria-label="页码"
                />
                页
              </label>
            </div>
          </div>
        </div>
        <div className="ietm-ref-pub-dialog__foot">
          <button
            type="button"
            className="ietm-ref-pub-btn"
            onClick={() => closeInsertPublication()}
          >
            取消
          </button>
          <button
            type="button"
            className="ietm-ref-pub-btn ietm-ref-pub-btn--primary"
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReferencePublicationModal() {
  const isOpen = useInsertPublicationModalStore((s) => s.isOpen)
  const openNonce = useInsertPublicationModalStore((s) => s.openNonce)

  if (!isOpen) return null

  return createPortal(
    <ReferencePublicationDialog key={openNonce} />,
    document.body,
  )
}
