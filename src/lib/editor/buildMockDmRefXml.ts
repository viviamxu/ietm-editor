/** mock「引用出版物」表格行 → S1000D `<dmRef>` 片段（仅内置演示用）。 */
export type MockExternalRefPublicationRow = {
  title: string;
  code: string;
  version: string;
  languageIsoCode?: string;
  countryIsoCode?: string;
  techName?: string;
};

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 由 mock 行生成可插入编辑器的完整 `<dmRef>…</dmRef>` 字符串。 */
export function buildMockDmRefRawXml(row: MockExternalRefPublicationRow): string {
  const techName = escapeXmlAttr(row.techName?.trim() || "数据模块");
  const infoName = escapeXmlAttr(row.title.trim() || "出版物");
  const modelIdentCode = escapeXmlAttr(
    row.code.split("-")[0]?.trim() || "S1000DBIKE",
  );
  const issueNumber = escapeXmlAttr(row.version.split("-")[0]?.trim() || "001");
  const inWork = escapeXmlAttr(
    row.version.includes("-") ? row.version.split("-")[1] : "00",
  );
  const languageIsoCode = escapeXmlAttr(row.languageIsoCode ?? "zh");
  const countryIsoCode = escapeXmlAttr(row.countryIsoCode ?? "CN");

  return `<dmRef>
  <dmRefIdent>
    <dmCode modelIdentCode="${modelIdentCode}" systemDiffCode="AAA" systemCode="DA0" subSystemCode="1" subSubSystemCode="0" assyCode="20" disassyCode="00" disassyCodeVariant="AA" infoCode="400" infoCodeVariant="A" itemLocationCode="A" />
    <issueInfo issueNumber="${issueNumber}" inWork="${inWork}" />
    <language languageIsoCode="${languageIsoCode}" countryIsoCode="${countryIsoCode}" />
  </dmRefIdent>
  <dmRefAddressItems>
    <dmTitle>
      <techName>${techName}</techName>
      <infoName>${infoName}</infoName>
    </dmTitle>
  </dmRefAddressItems>
</dmRef>`;
}
