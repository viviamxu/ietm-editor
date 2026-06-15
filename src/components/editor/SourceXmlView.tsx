import { memo, useMemo, useState } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import createElement from "react-syntax-highlighter/dist/esm/create-element";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import formatXml from "xml-formatter";
import type { ReactNode } from "react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";
import { IconRight, IconDown } from "@arco-design/web-react/icon";

import { useThemeStore } from "../../store/themeStore";

SyntaxHighlighter.registerLanguage("xml", markup);

interface SourceXmlViewProps {
  xml: string;
}

interface XmlFoldRange {
  key: string;
  tagName: string;
  startLine: number;
  endLine: number;
}

interface XmlOpenTag {
  tagName: string;
  line: number;
}

const TAG_TOKEN_RE = /<\s*(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)\s*>/g;

function formatXmlForSourceView(xml: string): string {
  try {
    return formatXml(xml, {
      indentation: "  ",
      collapseContent: false,
      lineSeparator: "\n",
    });
  } catch {
    return xml.replace(/\r\n?/g, "\n");
  }
}

function collectXmlFoldRanges(xml: string): XmlFoldRange[] {
  const ranges: XmlFoldRange[] = [];
  const stack: XmlOpenTag[] = [];
  const lines = xml.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    TAG_TOKEN_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TAG_TOKEN_RE.exec(line)) != null) {
      const fullToken = match[0];
      if (
        fullToken.startsWith("<?") ||
        fullToken.startsWith("<!") ||
        fullToken.startsWith("<!--")
      ) {
        continue;
      }

      const isClosing = match[1] === "/";
      const tagName = match[2];
      const isSelfClosing = match[4] === "/" || /\/\s*>$/.test(fullToken);

      if (isClosing) {
        const stackIndex = stack
          .map((item) => item.tagName)
          .lastIndexOf(tagName);
        if (stackIndex < 0) continue;

        const [openTag] = stack.splice(stackIndex, 1);
        if (lineIndex > openTag.line) {
          ranges.push({
            key: `${openTag.line}-${lineIndex}-${tagName}`,
            tagName,
            startLine: openTag.line,
            endLine: lineIndex,
          });
        }
        continue;
      }

      if (!isSelfClosing) {
        stack.push({ tagName, line: lineIndex });
      }
    }
  });

  return ranges;
}

export const SourceXmlView = memo(function SourceXmlView({
  xml,
}: SourceXmlViewProps) {
  const resolvedTheme = useThemeStore((state) => state.resolved);
  const prismStyle = resolvedTheme === "dark" ? oneDark : oneLight;
  const lineNumberStyle = useMemo(
    () => ({
      minWidth: "2.5em",
      paddingRight: "1em",
      color:
        resolvedTheme === "dark"
          ? "var(--ietm-text-muted)"
          : "#9ca3af",
      userSelect: "none" as const,
    }),
    [resolvedTheme],
  );

  const [collapsedRanges, setCollapsedRanges] = useState<
    Record<string, boolean>
  >({});

  const displayXml = useMemo(() => formatXmlForSourceView(xml), [xml]);
  const foldRanges = useMemo(
    () => collectXmlFoldRanges(displayXml),
    [displayXml],
  );
  const foldRangeByStartLine = useMemo(() => {
    const map = new Map<number, XmlFoldRange>();
    foldRanges.forEach((range) => {
      const existing = map.get(range.startLine);
      if (!existing || range.endLine > existing.endLine) {
        map.set(range.startLine, range);
      }
    });
    return map;
  }, [foldRanges]);

  const hiddenLines = useMemo(() => {
    const hidden = new Set<number>();
    foldRanges.forEach((range) => {
      if (!collapsedRanges[range.key]) return;
      for (let line = range.startLine + 1; line <= range.endLine; line += 1) {
        hidden.add(line);
      }
    });
    return hidden;
  }, [collapsedRanges, foldRanges]);

  const renderedLines = useMemo<
    NonNullable<SyntaxHighlighterProps["renderer"]>
  >(
    () =>
      ({ rows, stylesheet, useInlineStyles }): ReactNode =>
        rows.map((row, index) => {
          if (hiddenLines.has(index)) return null;

          const foldRange = foldRangeByStartLine.get(index);
          const isCollapsed =
            foldRange != null && collapsedRanges[foldRange.key] === true;

          return (
            <span
              key={`xml-line-${index}`}
              className={
                isCollapsed
                  ? "ietm-source-xml-view__line is-collapsed"
                  : "ietm-source-xml-view__line"
              }
            >
              {foldRange ? (
                <button
                  type="button"
                  className="ietm-source-xml-view__fold-btn"
                  aria-label={
                    isCollapsed
                      ? `展开 ${foldRange.tagName} 标签`
                      : `折叠 ${foldRange.tagName} 标签`
                  }
                  title={isCollapsed ? "展开标签" : "折叠标签"}
                  onClick={() => {
                    setCollapsedRanges((current) => ({
                      ...current,
                      [foldRange.key]: !current[foldRange.key],
                    }));
                  }}
                >
                  {isCollapsed ? <IconRight /> : <IconDown />}
                </button>
              ) : (
                <span
                  className="ietm-source-xml-view__fold-spacer"
                  aria-hidden
                />
              )}
              <span className="ietm-source-xml-view__line-code">
                {createElement({
                  node: row,
                  stylesheet,
                  useInlineStyles,
                  key: `xml-code-${index}`,
                })}
                {isCollapsed ? (
                  <span className="ietm-source-xml-view__fold-summary">
                    ...
                  </span>
                ) : null}
              </span>
            </span>
          );
        }),
    [collapsedRanges, foldRangeByStartLine, hiddenLines],
  );

  return (
    <div className="ietm-source-xml-view" aria-readonly="true">
      <SyntaxHighlighter
        language="xml"
        style={prismStyle}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
        }}
        codeTagProps={{
          className: "ietm-source-xml-view__code",
        }}
        lineNumberStyle={lineNumberStyle}
        showLineNumbers
        renderer={renderedLines}
      >
        {displayXml}
      </SyntaxHighlighter>
    </div>
  );
});
