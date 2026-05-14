import type { Editor } from "@tiptap/core";
import type { InspectTarget } from "../../lib/editor/resolveInspectable";
import { tableDimensions } from "../../lib/editor/resolveInspectable";
import {
  SOURCE_XML_ATTR_KEYS,
  mergeSourceXmlAttrKeysAfterPatch,
  shouldShowSecondaryPanelAttr,
} from "../../lib/s1000d/sourceXmlAttrKeys";

const UNIT_PRESETS = ["ph01(h)", "mm", "in", "deg"];

/** 不在「ID 下方」列表中展示的编辑器内部属性 */
const HIDDEN_ATTR_KEYS = new Set([
  "class",
  "start",
  SOURCE_XML_ATTR_KEYS,
]);

const ATTR_ORDER: Partial<Record<string, string[]>> = {
  para: [
    "securityClassification",
    "caveat",
    "derivativeClassificationRefId",
    "reasonForUpdateRefIds",
  ],
  image: ["src", "alt", "title", "unitOfMeasure", "width", "height"],
  title: ["displayLevel"],
  graphic: ["infoEntityIdent"],
  tgroup: ["cols", "colsep", "rowsep"],
  entry: ["colname", "namest", "nameend", "morerows", "align"],
  internalRef: ["internalRefId", "internalRefTargetType"],
  table: [],
  figure: [],
  levelledPara: [],
  warning: [],
  caution: [],
  note: [],
  dmRef: ["rawXml"],
};

function primaryIdKey(nodeType: string, schemaAttrs: Record<string, unknown>) {
  if (nodeType === "image" && "figureId" in schemaAttrs) return "figureId";
  if ("id" in schemaAttrs) return "id";
  return null;
}

function sortOtherKeys(
  nodeType: string,
  keys: string[],
  primary: string | null,
): string[] {
  const preferred = ATTR_ORDER[nodeType] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of preferred) {
    if (primary && k === primary) continue;
    if (!keys.includes(k)) continue;
    if (HIDDEN_ATTR_KEYS.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  const rest = keys
    .filter(
      (k) =>
        k !== primary &&
        !seen.has(k) &&
        !HIDDEN_ATTR_KEYS.has(k),
    )
    .sort((a, b) => a.localeCompare(b));
  return [...out, ...rest];
}

function stringifyAttr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v);
}

function parseAttrValue(key: string, raw: string): string | number | null {
  const t = raw.trim();
  if (t === "") return null;
  if (key === "width" || key === "height") {
    const n = Number.parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
  }
  return t;
}

export interface S1000DPropertyPanelProps {
  editor: Editor;
  target: InspectTarget;
  onDismiss: () => void;
}

export function S1000DPropertyPanel({
  editor,
  target,
  onDismiss,
}: S1000DPropertyPanelProps) {
  const nodeSpec = editor.schema.nodes[target.nodeType];
  const schemaAttrKeys = nodeSpec
    ? Object.keys(nodeSpec.spec.attrs ?? {})
    : [];

  const schemaAttrKeysForMerge = schemaAttrKeys.filter(
    (k) => !HIDDEN_ATTR_KEYS.has(k),
  );

  const primaryKey = primaryIdKey(target.nodeType, nodeSpec?.spec.attrs ?? {});

  const liveNode = editor.state.doc.nodeAt(target.pos);
  const liveAttrs =
    liveNode && liveNode.type.name === target.nodeType
      ? ({ ...liveNode.attrs } as Record<string, unknown>)
      : target.attrs;

  const applyPatch = (patch: Record<string, unknown>) => {
    const n = editor.state.doc.nodeAt(target.pos);
    if (!n || n.type.name !== target.nodeType) return;
    const merged = mergeSourceXmlAttrKeysAfterPatch({
      liveAttrs,
      primaryKey,
      patch,
      schemaAttrKeys: schemaAttrKeysForMerge,
    });
    editor
      .chain()
      .focus()
      .setNodeSelection(target.pos)
      .updateAttributes(target.nodeType, merged)
      .run();
  };

  const orderedOtherKeys = sortOtherKeys(
    target.nodeType,
    schemaAttrKeys.filter(
      (k) => !HIDDEN_ATTR_KEYS.has(k) && k !== SOURCE_XML_ATTR_KEYS,
    ),
    primaryKey,
  );

  const otherKeys = orderedOtherKeys.filter((key) =>
    shouldShowSecondaryPanelAttr({
      nodeType: target.nodeType,
      attrKey: key,
      liveAttrs,
      primaryKey,
    }),
  );

  const dim =
    target.nodeType === "table"
      ? tableDimensions(editor, target.pos)
      : null;

  const typeLabel =
    target.nodeType === "image"
      ? "图片（figure / graphic）"
      : target.nodeType;

  return (
    <div className="ietm-property-panel">
      <div className="ietm-property-panel__head">
        <h2 className="ietm-property-panel__title">属性设置</h2>
        <button
          type="button"
          className="ietm-property-panel__close"
          onClick={onDismiss}
          aria-label="关闭属性面板"
        >
          ×
        </button>
      </div>
      <div className="ietm-property-panel__body">
        <p className="ietm-prop-hint ietm-prop-hint--node">
          节点：<strong>{typeLabel}</strong>
        </p>

        {primaryKey ? (
          <label className="ietm-prop-field">
            <span>ID</span>
            <input
              type="text"
              value={stringifyAttr(liveAttrs[primaryKey])}
              onChange={(e) => {
                const v = e.target.value;
                applyPatch({
                  [primaryKey]: v === "" ? null : v,
                } as Record<string, unknown>);
              }}
            />
          </label>
        ) : null}

        {target.nodeType === "table" ? (
          <>
            <p className="ietm-prop-hint">
              表格结构与单元格内容可在编辑区直接调整。
            </p>
            {dim ? (
              <>
                <div className="ietm-prop-readonly">
                  <span>行数</span>
                  <span>{dim.rows}</span>
                </div>
                <div className="ietm-prop-readonly">
                  <span>列数</span>
                  <span>{dim.cols}</span>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {otherKeys.map((key) => {
          if (primaryKey && key === primaryKey) return null;
          const val = liveAttrs[key];
          if (key === "unitOfMeasure" && target.nodeType === "image") {
            const s = stringifyAttr(val);
            const options = [...UNIT_PRESETS];
            if (s && !options.includes(s)) options.unshift(s);
            return (
              <label key={key} className="ietm-prop-field">
                <span>{key}</span>
                <select
                  value={s || options[0] || ""}
                  onChange={(e) =>
                    applyPatch({ unitOfMeasure: e.target.value })
                  }
                >
                  {options.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (key === "displayLevel" && target.nodeType === "title") {
            return (
              <label key={key} className="ietm-prop-field">
                <span>{key}</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={
                    typeof val === "number"
                      ? val
                      : Number.parseInt(String(val ?? "1"), 10) || 1
                  }
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    applyPatch({
                      displayLevel: Number.isNaN(n) ? 1 : n,
                    });
                  }}
                />
              </label>
            );
          }

          if (key === "rawXml" && target.nodeType === "dmRef") {
            return (
              <label key={key} className="ietm-prop-field">
                <span>{key}</span>
                <textarea
                  rows={6}
                  className="ietm-prop-textarea"
                  value={String(val ?? "")}
                  onChange={(e) => applyPatch({ rawXml: e.target.value })}
                />
              </label>
            );
          }

          return (
            <label key={key} className="ietm-prop-field">
              <span>{key}</span>
              <input
                type="text"
                value={stringifyAttr(val)}
                onChange={(e) =>
                  applyPatch({
                    [key]: parseAttrValue(key, e.target.value),
                  } as Record<string, unknown>)
                }
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
