export type DmRefDisplayMeta = {
  title: string;
  code: string;
  dmCode: Record<string, string>;
  issueInfo: { issueNumber: string; inWork: string };
  language: { languageIsoCode: string; countryIsoCode: string };
};

const DM_CODE_ATTR_ORDER = [
  "modelIdentCode",
  "systemDiffCode",
  "systemCode",
  "subSystemCode",
  "subSubSystemCode",
  "assyCode",
  "disassyCode",
  "disassyCodeVariant",
  "infoCode",
  "infoCodeVariant",
  "itemLocationCode",
] as const;

function readDmCodeAttrs(dmCodeEl: Element | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!dmCodeEl) return out;
  for (const name of DM_CODE_ATTR_ORDER) {
    const v = dmCodeEl.getAttribute(name)?.trim();
    if (v) out[name] = v;
  }
  return out;
}

/** 将 `dmCode` 属性格式化为可读编码串（用于 Popover）。 */
export function formatDmCodeLabel(dmCode: Record<string, string>): string {
  const parts = DM_CODE_ATTR_ORDER.map((k) => dmCode[k]).filter(Boolean);
  return parts.join("-");
}

function parseDmRefXmlDocument(xml: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return null;
    return doc;
  } catch {
    return null;
  }
}

/** 从 `dmRef` 的 `rawXml`（及可选编辑器 `displayCode`）解析展示元数据。 */
export function parseDmRefDisplayMeta(
  rawXml: string | null | undefined,
  displayCode?: string | null,
): DmRefDisplayMeta {
  const xml = String(rawXml ?? "").trim();
  const codeFromAttr = String(displayCode ?? "").trim();

  let title = "";
  let dmCode: Record<string, string> = {};
  let issueInfo = { issueNumber: "", inWork: "" };
  let language = { languageIsoCode: "", countryIsoCode: "" };

  const doc = xml ? parseDmRefXmlDocument(xml) : null;
  if (doc) {
    title =
      doc.querySelector("infoName")?.textContent?.trim() ||
      doc.querySelector("techName")?.textContent?.trim() ||
      "";
    dmCode = readDmCodeAttrs(doc.querySelector("dmCode"));
    const issueEl = doc.querySelector("issueInfo");
    issueInfo = {
      issueNumber: issueEl?.getAttribute("issueNumber")?.trim() ?? "",
      inWork: issueEl?.getAttribute("inWork")?.trim() ?? "",
    };
    const langEl = doc.querySelector("language");
    language = {
      languageIsoCode: langEl?.getAttribute("languageIsoCode")?.trim() ?? "",
      countryIsoCode: langEl?.getAttribute("countryIsoCode")?.trim() ?? "",
    };
  }

  if (!title) {
    const infoMatch = /<infoName[^>]*>([^<]*)<\/infoName>/i.exec(xml);
    if (infoMatch?.[1]?.trim()) title = infoMatch[1].trim();
  }

  const code =
    codeFromAttr || formatDmCodeLabel(dmCode) || title || "外部引用";

  return { title: title || code, code, dmCode, issueInfo, language };
}

/** 从 `dmRef` 的 `rawXml` 解析用于编辑器展示的主标题（`<infoName>`）。 */
export function parseDmRefDisplayTitle(
  rawXml: string | null | undefined,
  displayCode?: string | null,
): string {
  const meta = parseDmRefDisplayMeta(rawXml, displayCode);
  return meta.title || meta.code || "外部引用";
}
