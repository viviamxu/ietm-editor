/** 按括号深度为 0 的 `|` 拆出顶层 OR 分支（描述类 `description.content` 等）。 */
export function splitTopLevelAlternatives(rule: string): string[] {
  const trimmed = rule.trim();
  if (!trimmed) return [];

  const alts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "|" && depth === 0) {
      const part = trimmed.slice(start, i).trim();
      if (part) alts.push(part);
      start = i + 1;
    }
  }

  const tail = trimmed.slice(start).trim();
  if (tail) alts.push(tail);
  return alts.length > 0 ? alts : [trimmed];
}

export type ContentSegment = {
  alternatives: string[];
  quantifier: "+" | "*" | "?" | "";
};

/** `(para* warning* …)*` 这类「整段序列外包括号」：内层含空格且顶层无 `|`。 */
function isSequenceWrapperInner(inner: string): boolean {
  let depth = 0;
  let hasDepth0Space = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (/\s/.test(ch) && depth === 0) {
      hasDepth0Space = true;
      break;
    }
  }
  if (!hasDepth0Space) return false;
  depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "|" && depth === 0) return false;
  }
  return true;
}

/**
 * 剥掉最外层 `( sequence )*` / `( sequence )+` / `( sequence )?`，便于解析描述类第一 OR 支。
 */
export function normalizeSequenceWrapperRule(rule: string): string {
  const trimmed = rule.trim();
  if (!trimmed.startsWith("(")) return trimmed;

  let depth = 0;
  let close = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return trimmed;

  let end = close + 1;
  if (end < trimmed.length && /[*+?]/.test(trimmed[end])) end++;
  if (end !== trimmed.length) return trimmed;

  const inner = trimmed.slice(1, close).trim();
  if (!isSequenceWrapperInner(inner)) return trimmed;
  return inner;
}

/**
 * 解析单条 content 规则中的序列项（支持嵌套括号，如 `(levelledPara | levelledParaAlts)*`）。
 */
export function parseContentSegments(rule: string): ContentSegment[] {
  const trimmed = normalizeSequenceWrapperRule(rule.trim());
  if (!trimmed) return [];

  const segments: ContentSegment[] = [];
  let i = 0;

  while (i < trimmed.length) {
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
    if (i >= trimmed.length) break;

    if (trimmed[i] === "(") {
      const open = i;
      i++;
      let depth = 1;
      while (i < trimmed.length && depth > 0) {
        if (trimmed[i] === "(") depth++;
        else if (trimmed[i] === ")") depth--;
        i++;
      }
      const close = i - 1;
      let quantifier = "" as ContentSegment["quantifier"];
      if (i < trimmed.length && /[*+?]/.test(trimmed[i])) {
        quantifier = trimmed[i] as ContentSegment["quantifier"];
        i++;
      }
      const inner = trimmed.slice(open + 1, close);
      segments.push({
        alternatives: splitTopLevelAlternatives(inner),
        quantifier,
      });
    } else {
      const start = i;
      while (i < trimmed.length && !/\s/.test(trimmed[i]) && trimmed[i] !== "(") {
        i++;
      }
      const raw = trimmed.slice(start, i);
      const quantMatch = raw.match(/([*+?])$/);
      const quantifier = (quantMatch?.[1] ?? "") as ContentSegment["quantifier"];
      const core = quantMatch ? raw.slice(0, -1) : raw;
      segments.push({ alternatives: [core], quantifier });
    }
  }

  return segments;
}

/**
 * 递归展开一条 OR 备选（含嵌套 `(a | (b | c))`），返回叶子 token（去掉 `*+?`）。
 */
export function flattenContentAlternative(alt: string): string[] {
  const trimmed = alt.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("(")) {
    let depth = 0;
    let close = -1;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close >= 0) {
      const tail = trimmed.slice(close + 1).trim();
      if (tail === "" || /^[*+?]$/.test(tail)) {
        const inner = trimmed.slice(1, close);
        return splitTopLevelAlternatives(inner).flatMap(flattenContentAlternative);
      }
    }
  }

  if (/[(\s]/.test(trimmed)) {
    const nested = parseContentSegments(trimmed);
    if (nested.length > 0) {
      const expanded = nested.flatMap((seg) =>
        seg.alternatives.flatMap(flattenContentAlternative),
      );
      if (expanded.length > 0) return expanded;
    }
  }

  const core = trimmed.replace(/[*+?]$/, "").trim();
  return core ? [core] : [];
}

/** 规则字符串是否包含独立 token（用于空文档骨架与插入能力探测）。 */
export function contentRuleMentions(
  rule: string | undefined,
  token: string,
): boolean {
  if (!rule) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(rule);
}

/** 取描述类 `description.content` 的第一个 OR 分支（空文档默认结构）。 */
export function firstTopLevelContentBranch(rule: string): string {
  const branches = splitTopLevelAlternatives(rule);
  return branches[0] ?? rule.trim();
}
