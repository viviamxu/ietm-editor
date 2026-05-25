import type { Node as PMNode } from "@tiptap/pm/model";

/** 隔离步骤默认标题：`步骤标题1`、`步骤标题2`… */
export function defaultIsolationStepTitle(index: number): string {
  return `步骤标题${index}`;
}

/** 结束块默认标题：`结束标题1`、`结束标题2`… */
export function defaultIsolationEndTitle(index: number): string {
  return `结束标题${index}`;
}

/** 从 `title` 节点提取纯文本。 */
export function getTitleTextFromNode(titleNode: PMNode | null | undefined): string {
  if (!titleNode || titleNode.type.name !== "title") return "";
  let text = "";
  titleNode.descendants((n) => {
    if (n.isText) text += n.text ?? "";
  });
  return text.trim();
}

function elementLocalName(el: Element): string {
  return el.localName?.toLowerCase() ?? "";
}

function getTitleTextFromElement(parent: Element): string {
  const title = Array.from(parent.children).find(
    (c) => elementLocalName(c) === "title",
  );
  if (!title) return "";
  return title.textContent?.trim() ?? "";
}

function setDefaultTitleOnElement(parent: Element, text: string): void {
  const doc = parent.ownerDocument;
  if (!doc) return;
  let title = Array.from(parent.children).find(
    (c) => elementLocalName(c) === "title",
  );
  if (!title) {
    title = doc.createElement("title");
    parent.insertBefore(title, parent.firstElementChild);
  }
  if (!getTitleTextFromElement(parent)) {
    title.textContent = text;
  }
}

function normalizeIsolationMainProcedureElement(main: Element): void {
  let stepIndex = 0;
  let endIndex = 0;
  for (const child of Array.from(main.children)) {
    const tag = elementLocalName(child);
    if (tag === "isolationstep") {
      stepIndex += 1;
      if (!getTitleTextFromElement(child)) {
        setDefaultTitleOnElement(child, defaultIsolationStepTitle(stepIndex));
      }
    } else if (tag === "isolationprocedureend") {
      endIndex += 1;
      if (!getTitleTextFromElement(child)) {
        setDefaultTitleOnElement(child, defaultIsolationEndTitle(endIndex));
      }
    }
  }
}

const FAULT_FRAGMENT_XML_WRAPPER = "faultFragment";

/**
 * 导入前在 XML 片段上为空的 `title` 填入默认名（步骤/结束按顺序编号）。
 * 必须使用 `application/xml`：HTML 解析会把多个 `<title>` 吞掉，导致只保留第一个步骤。
 */
export function normalizeFaultIsolationTitlesInFragmentXml(
  fragmentXml: string,
): string {
  const trimmed = fragmentXml.trim();
  if (!trimmed) return fragmentXml;

  const doc = new DOMParser().parseFromString(
    `<${FAULT_FRAGMENT_XML_WRAPPER}>${trimmed}</${FAULT_FRAGMENT_XML_WRAPPER}>`,
    "application/xml",
  );
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return fragmentXml;
  }

  const root = doc.documentElement;
  if (
    !root ||
    elementLocalName(root) !== FAULT_FRAGMENT_XML_WRAPPER.toLowerCase()
  ) {
    return fragmentXml;
  }

  const walk = (el: Element) => {
    if (elementLocalName(el) === "isolationmainprocedure") {
      normalizeIsolationMainProcedureElement(el);
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  };
  walk(root);

  const serializer = new XMLSerializer();
  const parts: string[] = [];
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      parts.push(serializer.serializeToString(child as Element));
    }
  }
  return parts.length > 0 ? parts.join("") : fragmentXml;
}

export function findIsolationMainProcedureAncestor(
  doc: PMNode,
  blockPos: number,
): { main: PMNode; mainPos: number } | null {
  try {
    const $pos = doc.resolve(blockPos);
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === "isolationMainProcedure") {
        return { main: $pos.node(d), mainPos: $pos.before(d) };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** 在 `isolationMainProcedure` 内，`isolationStep` 的 1-based 序号。 */
export function getIsolationStepIndexInMain(
  main: PMNode,
  stepPos: number,
  mainPos: number,
): number {
  let offset = 1;
  let index = 0;
  for (let i = 0; i < main.childCount; i++) {
    const child = main.child(i);
    const childPos = mainPos + offset;
    if (child.type.name === "isolationStep") {
      index += 1;
      if (childPos === stepPos) return index;
    }
    offset += child.nodeSize;
  }
  return Math.max(1, index);
}

/** 在 `isolationMainProcedure` 内，`isolationProcedureEnd` 的 1-based 序号。 */
export function getIsolationEndIndexInMain(
  main: PMNode,
  endPos: number,
  mainPos: number,
): number {
  let offset = 1;
  let index = 0;
  for (let i = 0; i < main.childCount; i++) {
    const child = main.child(i);
    const childPos = mainPos + offset;
    if (child.type.name === "isolationProcedureEnd") {
      index += 1;
      if (childPos === endPos) return index;
    }
    offset += child.nodeSize;
  }
  return Math.max(1, index);
}

/** 根据步骤/结束块在文档中的位置计算默认标题文案。 */
export function getDefaultTitleForIsolationBlock(
  doc: PMNode,
  blockPos: number,
  blockType: "isolationStep" | "isolationProcedureEnd",
): string {
  const ctx = findIsolationMainProcedureAncestor(doc, blockPos);
  if (!ctx) {
    return blockType === "isolationStep"
      ? defaultIsolationStepTitle(1)
      : defaultIsolationEndTitle(1);
  }
  if (blockType === "isolationStep") {
    const index = getIsolationStepIndexInMain(
      ctx.main,
      blockPos,
      ctx.mainPos,
    );
    return defaultIsolationStepTitle(index);
  }
  const index = getIsolationEndIndexInMain(ctx.main, blockPos, ctx.mainPos);
  return defaultIsolationEndTitle(index);
}
