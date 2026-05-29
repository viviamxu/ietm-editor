import type { Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";

export const LEVELLED_PARA = "levelledPara";
export const TITLE = "title";

const TITLE_CAPTION_PARENT_TYPES = new Set(["figure", "table", "multimedia"]);

/** 将路径 [2, 1] 格式化为展示用序号 `2.1.` */
export function formatSectionNumber(path: readonly number[]): string {
  if (path.length === 0) return "";
  return `${path.join(".")}.`;
}

/** 匹配标题正文开头与给定路径一致的序号前缀（导入时剥离历史导出残留） */
export function leadingSectionNumberPrefixRegex(
  path: readonly number[],
): RegExp | null {
  if (path.length === 0) return null;
  const core = path.map((n) => String(n)).join("\\.");
  return new RegExp(`^${core}\\.?\\s*`);
}

export function isChapterSectionTitle(doc: PMNode, titlePos: number): boolean {
  try {
    const $pos = doc.resolve(titlePos + 1);
    return isChapterSectionTitleAtResolved($pos);
  } catch {
    return false;
  }
}

function isChapterSectionTitleAtResolved($pos: ResolvedPos): boolean {
  let titleDepth = -1;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === TITLE) {
      titleDepth = d;
      break;
    }
  }
  if (titleDepth < 0) return false;

  const parentType = $pos.node(titleDepth - 1).type.name;
  if (TITLE_CAPTION_PARENT_TYPES.has(parentType)) return false;

  for (let d = titleDepth - 1; d > 0; d--) {
    if ($pos.node(d).type.name === LEVELLED_PARA) return true;
  }
  return false;
}

/** 从 `title` 位置向上收集各级 `levelledPara` 在同级中的序号路径 */
export function computeLevelledParaSectionPath(
  doc: PMNode,
  titlePos: number,
): number[] {
  try {
    const $pos = doc.resolve(titlePos + 1);
    const path: number[] = [];
    for (let d = 1; d <= $pos.depth; d++) {
      if ($pos.node(d).type.name !== LEVELLED_PARA) continue;
      const parent = $pos.node(d - 1);
      const lpNode = $pos.node(d);
      let lpChildIndex = -1;
      for (let i = 0; i < parent.childCount; i++) {
        if (parent.child(i) === lpNode) {
          lpChildIndex = i;
          break;
        }
      }
      if (lpChildIndex < 0) continue;

      let sectionIndex = 0;
      for (let i = 0; i <= lpChildIndex; i++) {
        if (parent.child(i).type.name === LEVELLED_PARA) sectionIndex++;
      }
      if (sectionIndex > 0) path.push(sectionIndex);
    }
    return path;
  } catch {
    return [];
  }
}

export type SectionNumberAssignment = {
  titlePos: number;
  sectionNumber: string | null;
};

/**
 * 扫描全文 `title`：章节标题写入序号，图题等写入 `null` 以清除旧值。
 */
export function collectSectionNumberAssignments(
  doc: PMNode,
): SectionNumberAssignment[] {
  const out: SectionNumberAssignment[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== TITLE) return true;

    if (!isChapterSectionTitle(doc, pos)) {
      const curr = normalizeSectionNumberAttr(
        (node.attrs as { sectionNumber?: string | null }).sectionNumber,
      );
      if (curr !== null) {
        out.push({ titlePos: pos, sectionNumber: null });
      }
      return true;
    }

    const path = computeLevelledParaSectionPath(doc, pos);
    const next =
      path.length > 0 ? formatSectionNumber(path) : null;
    const curr = normalizeSectionNumberAttr(
      (node.attrs as { sectionNumber?: string | null }).sectionNumber,
    );
    if (!sectionNumberAttrsEqual(curr, next)) {
      out.push({ titlePos: pos, sectionNumber: next });
    }
    return true;
  });

  return out;
}

export function normalizeSectionNumberAttr(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export function sectionNumberAttrsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeSectionNumberAttr(a) === normalizeSectionNumberAttr(b);
}

/** 剥离标题行首与 path 一致的序号，返回是否发生修改 */
export function stripLeadingSectionNumberFromTitleNode(
  title: PMNode,
  path: readonly number[],
): { node: PMNode; changed: boolean } {
  const re = leadingSectionNumberPrefixRegex(path);
  if (!re || title.childCount === 0) {
    return { node: title, changed: false };
  }

  const first = title.child(0);
  if (!first.isText || !first.text) {
    return { node: title, changed: false };
  }

  const m = re.exec(first.text);
  if (!m) {
    return { node: title, changed: false };
  }

  const rest = first.text.slice(m[0].length);
  const nextFirst =
    rest.length > 0 ? first.type.schema.text(rest, first.marks) : null;
  const children: PMNode[] = [];
  if (nextFirst) children.push(nextFirst);
  for (let i = 1; i < title.childCount; i++) {
    children.push(title.child(i));
  }

  return {
    node: title.type.create(title.attrs, children),
    changed: true,
  };
}
