import { memo } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";

SyntaxHighlighter.registerLanguage("xml", markup);

interface SourceXmlViewProps {
  xml: string;
}

export const SourceXmlView = memo(function SourceXmlView({
  xml,
}: SourceXmlViewProps) {
  return (
    <div className="ietm-source-xml-view" aria-readonly="true">
      <SyntaxHighlighter
        language="xml"
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
        }}
        codeTagProps={{
          className: "ietm-source-xml-view__code",
        }}
        lineNumberStyle={{
          minWidth: "2.5em",
          paddingRight: "1em",
          color: "#9ca3af",
          userSelect: "none",
        }}
        showLineNumbers
      >
        {xml}
      </SyntaxHighlighter>
    </div>
  );
});
