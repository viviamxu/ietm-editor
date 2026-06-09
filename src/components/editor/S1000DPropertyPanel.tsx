import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import type { InspectTarget } from "../../lib/editor/resolveInspectable";
import { tableDimensions } from "../../lib/editor/resolveInspectable";
import { validatePrimaryIdForSave } from "../../lib/editor/validateDocumentNodeId";
import {
  FIGURE_PANEL_ATTR_NAMES,
  SOURCE_XML_ATTR_KEYS,
  mergeSourceXmlAttrKeysAfterPatch,
  shouldShowSecondaryPanelAttr,
} from "../../lib/s1000d/sourceXmlAttrKeys";

const UNIT_PRESETS = ["ph01(h)", "mm", "in", "deg"];

/** 不在「ID 下方」列表中展示的编辑器内部属性 */
const HIDDEN_ATTR_KEYS = new Set([
  "class",
  "start",
  /** 工具栏 TextAlign 使用，不落 S1000D XML、不在属性面板展示 */
  "textAlign",
  SOURCE_XML_ATTR_KEYS,
  /** 故障隔离：编辑器内分支缓存，不参与 S1000D 导出 */
  "cachedYesNoAnswerJson",
  "cachedListOfChoicesJson",
]);

const ATTR_ORDER: Partial<Record<string, string[]>> = {
  para: [
    "securityClassification",
    "caveat",
    "derivativeClassificationRefId",
    "reasonForUpdateRefIds",
  ],
  paragraph: [
    "securityClassification",
    "caveat",
    "derivativeClassificationRefId",
    "reasonForUpdateRefIds",
  ],
  image: ["src", "alt", "title", "unitOfMeasure", "width", "height"],
  title: ["displayLevel"],
  graphic: ["infoEntityIdent", "src"],
  multimediaObject: ["infoEntityIdent", "multimediaType"],
  multimedia: [],
  tgroup: ["cols", "colsep", "rowsep"],
  entry: ["colname", "namest", "nameend", "morerows", "align"],
  internalRef: ["internalRefId", "internalRefTargetType"],
  table: [],
  figure: [...FIGURE_PANEL_ATTR_NAMES],
  levelledPara: [],
  warning: [],
  caution: [],
  note: [],
  dmRef: ["rawXml"],
  isolationStep: [],
  isolationProcedureEnd: [],
  choice: ["nextActionRefId"],
  fault: ["faultCode"],
  yesAnswer: ["nextActionRefId"],
  noAnswer: ["nextActionRefId"],
  personnel: ["numRequired"],
  personCategory: ["personCategoryCode"],
  personSkill: ["skillLevelCode"],
  estimatedTime: ["unitOfMeasure"],
  reqQuantity: ["unitOfMeasure"],
  proceduralStep: ["derivativeClassificationRefId"],
};

/** 属性面板展示名（schema 字段名 → 源 XML 语义） */
const ATTR_LABEL: Partial<Record<string, Partial<Record<string, string>>>> = {
  graphic: { src: "xlink:href" },
  choice: { nextActionRefId: "下一步 (nextActionRefId)" },
  yesAnswer: { nextActionRefId: "下一步 (nextActionRefId)" },
  noAnswer: { nextActionRefId: "下一步 (nextActionRefId)" },
  fault: { faultCode: "故障代码 (faultCode)" },
  personnel: { numRequired: "人数 (numRequired)" },
  personCategory: { personCategoryCode: "人员类别 (personCategoryCode)" },
  personSkill: { skillLevelCode: "技能等级 (skillLevelCode)" },
  estimatedTime: { unitOfMeasure: "工时单位 (unitOfMeasure)" },
  reqQuantity: { unitOfMeasure: "数量单位 (unitOfMeasure)" },
};

const NODE_TYPE_LABEL: Partial<Record<string, string>> = {
  preliminaryRqmts: "准备要求 (preliminaryRqmts)",
  mainProcedure: "主程序 (mainProcedure)",
  closeRqmts: "结束要求 (closeRqmts)",
  reqCondGroup: "作业条件组 (reqCondGroup)",
  reqCondNoRef: "作业条件 (reqCondNoRef)",
  reqPersons: "人员要求 (reqPersons)",
  personnel: "人员 (personnel)",
  reqSupportEquips: "工装要求 (reqSupportEquips)",
  reqSupplies: "辅料要求 (reqSupplies)",
  reqSpares: "备件要求 (reqSpares)",
  reqSafety: "安全要求 (reqSafety)",
  proceduralStep: "程序步骤 (proceduralStep)",
  supportEquipDescr: "工装 (supportEquipDescr)",
  supplyDescr: "辅料 (supplyDescr)",
  spareDescr: "备件 (spareDescr)",
  safetyRqmts: "安全要求内容 (safetyRqmts)",
  isolationStep: "隔离步骤 (isolationStep)",
  isolationProcedureEnd: "隔离结束 (isolationProcedureEnd)",
  choice: "选项 (choice)",
  fault: "故障 (fault)",
  yesAnswer: "是 (yesAnswer)",
  noAnswer: "否 (noAnswer)",
};

function attrPanelLabel(nodeType: string, key: string): string {
  return ATTR_LABEL[nodeType]?.[key] ?? key;
}

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

function readAttrsAtTarget(
  editor: Editor,
  target: InspectTarget,
): Record<string, unknown> {
  const liveNode = editor.state.doc.nodeAt(target.pos);
  if (liveNode && liveNode.type.name === target.nodeType) {
    return { ...liveNode.attrs } as Record<string, unknown>;
  }
  return { ...target.attrs };
}

export interface S1000DPropertyPanelProps {
  editor: Editor;
  target: InspectTarget;
  onDismiss: () => void;
  /** 只读时禁止修改属性；关闭按钮仍可用 */
  readOnly?: boolean;
}

export function S1000DPropertyPanel({
  editor,
  target,
  onDismiss,
  readOnly = false,
}: S1000DPropertyPanelProps) {
  const nodeSpec = editor.schema.nodes[target.nodeType];
  const schemaAttrKeys = nodeSpec
    ? Object.keys(nodeSpec.spec.attrs ?? {})
    : [];

  const schemaAttrKeysForMerge = schemaAttrKeys.filter(
    (k) => !HIDDEN_ATTR_KEYS.has(k),
  );

  const primaryKey = primaryIdKey(target.nodeType, nodeSpec?.spec.attrs ?? {});

  const [draftAttrs, setDraftAttrs] = useState<Record<string, unknown>>(() =>
    readAttrsAtTarget(editor, target),
  );
  const [primaryIdError, setPrimaryIdError] = useState<string | null>(null);

  useEffect(() => {
    setDraftAttrs(readAttrsAtTarget(editor, target));
    setPrimaryIdError(null);
  }, [editor, target.pos, target.nodeType, target.attrs]);

  const setDraftField = (key: string, value: unknown) => {
    setDraftAttrs((prev) => ({ ...prev, [key]: value }));
    if (primaryKey && key === primaryKey) {
      setPrimaryIdError(null);
    }
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
      liveAttrs: draftAttrs,
      primaryKey,
    }),
  );

  const commitDraft = () => {
    const n = editor.state.doc.nodeAt(target.pos);
    if (!n || n.type.name !== target.nodeType) return;

    const liveAttrs = readAttrsAtTarget(editor, target);
    const patch: Record<string, unknown> = {};
    if (primaryKey) {
      patch[primaryKey] = draftAttrs[primaryKey];
    }
    for (const key of otherKeys) {
      patch[key] = draftAttrs[key];
    }

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

  const handleConfirm = () => {
    if (!readOnly) {
      if (primaryKey) {
        const idError = validatePrimaryIdForSave(
          editor,
          stringifyAttr(draftAttrs[primaryKey]),
          target.pos,
        );
        if (idError) {
          setPrimaryIdError(idError);
          return;
        }
      }
      setPrimaryIdError(null);
      commitDraft();
    }
    onDismiss();
  };

  const dim =
    target.nodeType === "table"
      ? tableDimensions(editor, target.pos)
      : null;

  const typeLabel =
    NODE_TYPE_LABEL[target.nodeType] ??
    (target.nodeType === "image"
      ? "图片（figure / graphic）"
      : target.nodeType === "paragraph"
        ? "段落（列表 / paragraph）"
        : target.nodeType);

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
              disabled={readOnly}
              className={
                primaryIdError ? "ietm-prop-field__input--invalid" : undefined
              }
              value={stringifyAttr(draftAttrs[primaryKey])}
              onChange={(e) => {
                const v = e.target.value;
                setDraftField(primaryKey, v === "" ? null : v);
              }}
            />
            {primaryIdError ? (
              <p className="ietm-prop-error" role="alert">
                {primaryIdError}
              </p>
            ) : null}
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
          const val = draftAttrs[key];
          if (key === "unitOfMeasure" && target.nodeType === "image") {
            const s = stringifyAttr(val);
            const options = [...UNIT_PRESETS];
            if (s && !options.includes(s)) options.unshift(s);
            return (
              <label key={key} className="ietm-prop-field">
                <span>{attrPanelLabel(target.nodeType, key)}</span>
                <select
                  disabled={readOnly}
                  value={s || options[0] || ""}
                  onChange={(e) =>
                    setDraftField("unitOfMeasure", e.target.value)
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
                <span>{attrPanelLabel(target.nodeType, key)}</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  disabled={readOnly}
                  value={
                    typeof val === "number"
                      ? val
                      : Number.parseInt(String(val ?? "1"), 10) || 1
                  }
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setDraftField(
                      "displayLevel",
                      Number.isNaN(n) ? 1 : n,
                    );
                  }}
                />
              </label>
            );
          }

          if (key === "rawXml" && target.nodeType === "dmRef") {
            return (
              <label key={key} className="ietm-prop-field">
                <span>{attrPanelLabel(target.nodeType, key)}</span>
                <textarea
                  rows={6}
                  className="ietm-prop-textarea"
                  disabled={readOnly}
                  value={String(val ?? "")}
                  onChange={(e) => setDraftField("rawXml", e.target.value)}
                />
              </label>
            );
          }

          return (
            <label key={key} className="ietm-prop-field">
              <span>{attrPanelLabel(target.nodeType, key)}</span>
              <input
                type="text"
                disabled={readOnly}
                value={stringifyAttr(val)}
                onChange={(e) =>
                  setDraftField(key, parseAttrValue(key, e.target.value))
                }
              />
            </label>
          );
        })}
      </div>
      {!readOnly ? (
        <div className="ietm-property-panel__footer">
          <button
            type="button"
            className="ietm-property-panel__confirm"
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      ) : null}
    </div>
  );
}
