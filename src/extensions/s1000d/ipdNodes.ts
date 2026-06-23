import { mergeAttributes, Node } from "@tiptap/core";
import { imeSafeReactNodeViewRenderer } from "../../lib/editor/imeSafeReactNodeViewRenderer";

import {
  SOURCE_XML_ATTR_KEYS,
  xmlAttrsPresentOnElement,
} from "../../lib/s1000d/sourceXmlAttrKeys";
import { CatalogSeqNumberGroupNodeView } from "./CatalogSeqNumberGroupNodeView";

const IPD_TEXT_GROUP = "block";

function readAttr(el: Element, name: string): string | null {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase());
}

function attrSpec(name: string) {
  return {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => readAttr(el, name),
    renderHTML: (attrs: Record<string, string | null | undefined>) => {
      const v = attrs[name];
      if (v == null || String(v).trim() === "") return {};
      return { [name]: String(v).trim() };
    },
  };
}

function tagRules(tag: string) {
  const lower = tag.toLowerCase();
  return [{ tag: lower }, { tag }];
}

function createInlineTextNode(name: string, group: string = IPD_TEXT_GROUP) {
  return Node.create({
    name,
    group,
    content: "inline*",
    parseHTML: () => tagRules(name),
    renderHTML({ HTMLAttributes }) {
      return [name, mergeAttributes(HTMLAttributes), 0];
    },
  });
}

function blockTagParseRules(tag: string, extraAttrs: string[] = ["id"]) {
  const lower = tag.toLowerCase();
  const readId = (el: Element) =>
    el.getAttribute("id") ?? el.getAttribute("data-s1000d-element-id");

  return [
    {
      tag: lower,
      getAttrs: (el: unknown) => {
        if (!(el instanceof Element)) return false;
        const attrs: Record<string, unknown> = {
          id: readId(el),
          [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, extraAttrs),
        };
        for (const key of extraAttrs) {
          if (key === "id") continue;
          attrs[key] = readAttr(el, key);
        }
        return attrs;
      },
    },
    { tag },
  ];
}

export const S1000DHotspot = Node.create({
  name: "hotspot",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      id: attrSpec("id"),
      hotspotTitle: attrSpec("hotspotTitle"),
      linkedCsnId: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => {
          if (!(el instanceof Element)) return null;
          const ref = el.querySelector("internalRef, internalref");
          if (!ref) return null;
          return (
            ref.getAttribute("internalRefId") ??
            ref.getAttribute("internalrefid")
          );
        },
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "hotspot",
        getAttrs: (el: unknown) => {
          if (!(el instanceof Element)) return false;
          const ref = el.querySelector("internalRef, internalref");
          return {
            id: readAttr(el, "id"),
            hotspotTitle: readAttr(el, "hotspotTitle"),
            linkedCsnId:
              ref?.getAttribute("internalRefId") ??
              ref?.getAttribute("internalrefid"),
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["hotspot", mergeAttributes(HTMLAttributes)];
  },
});

export const S1000DCatalogSeqNumberGroup = Node.create({
  name: "catalogSeqNumberGroup",
  group: "block",
  content: "catalogSeqNumber*",
  defining: true,
  parseHTML() {
    return [
      {
        tag: 'div[data-s1000d-node="catalogSeqNumberGroup"]',
      },
      {
        tag: "catalogSeqNumberGroup",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-s1000d-node": "catalogSeqNumberGroup",
      }),
      0,
    ];
  },
  addNodeView() {
    return imeSafeReactNodeViewRenderer(CatalogSeqNumberGroupNodeView);
  },
});

export const S1000DCatalogSeqNumber = Node.create({
  name: "catalogSeqNumber",
  group: "block",
  content: "itemSeqNumber+",
  defining: true,
  addAttributes() {
    return {
      id: attrSpec("id"),
      indenture: attrSpec("indenture"),
      figureNumber: attrSpec("figureNumber"),
      item: attrSpec("item"),
      hotspotRefId: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => {
          if (!(el instanceof Element)) return null;
          const fromData = el.getAttribute("data-hotspot-ref-id");
          if (fromData?.trim()) return fromData.trim();
          const ref = el.querySelector("internalRef, internalref");
          if (!ref) return null;
          return (
            ref.getAttribute("internalRefId") ??
            ref.getAttribute("internalrefid")
          );
        },
        renderHTML: (attrs) => {
          const v = (attrs as { hotspotRefId?: string | null }).hotspotRefId;
          return v?.trim() ? { "data-hotspot-ref-id": String(v).trim() } : {};
        },
      },
    };
  },
  parseHTML() {
    return blockTagParseRules("catalogSeqNumber", [
      "id",
      "indenture",
      "figureNumber",
      "item",
    ]);
  },
  renderHTML({ HTMLAttributes }) {
    return ["catalogSeqNumber", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DItemSeqNumber = Node.create({
  name: "itemSeqNumber",
  group: "block",
  content:
    "quantityPerNextHigherAssy? totalQuantity? partRef? partSegment",
  addAttributes() {
    return {
      itemSeqNumberValue: attrSpec("itemSeqNumberValue"),
    };
  },
  parseHTML() {
    return blockTagParseRules("itemSeqNumber", ["itemSeqNumberValue"]);
  },
  renderHTML({ HTMLAttributes }) {
    return ["itemSeqNumber", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DQuantityPerNextHigherAssy = createInlineTextNode(
  "quantityPerNextHigherAssy",
);
export const S1000DTotalQuantity = createInlineTextNode("totalQuantity");
export const S1000DDescrForPart = createInlineTextNode("descrForPart");
export const S1000DPartKeyword = createInlineTextNode("partKeyword");
export const S1000DOverLengthPartNumber = createInlineTextNode(
  "overLengthPartNumber",
);

export const S1000DPartRef = Node.create({
  name: "partRef",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      manufacturerCodeValue: attrSpec("manufacturerCodeValue"),
      partNumberValue: attrSpec("partNumberValue"),
    };
  },
  parseHTML() {
    return [
      {
        tag: "partRef",
        getAttrs: (el: unknown) => {
          if (!(el instanceof Element)) return false;
          return {
            manufacturerCodeValue: readAttr(el, "manufacturerCodeValue") ?? "",
            partNumberValue: readAttr(el, "partNumberValue") ?? "",
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string | null | undefined>;
    const manufacturer = String(attrs.manufacturerCodeValue ?? "").trim();
    const partNumber = String(attrs.partNumberValue ?? "").trim();
    return [
      "partRef",
      mergeAttributes({
        manufacturerCodeValue: manufacturer,
        partNumberValue: partNumber,
      }),
    ];
  },
});

export const S1000DPartSegment = Node.create({
  name: "partSegment",
  group: "block",
  content: "itemIdentData",
  parseHTML: () => tagRules("partSegment"),
  renderHTML({ HTMLAttributes }) {
    return ["partSegment", mergeAttributes(HTMLAttributes), 0];
  },
});

export const S1000DItemIdentData = Node.create({
  name: "itemIdentData",
  group: "block",
  content: "descrForPart? partKeyword? overLengthPartNumber?",
  parseHTML: () => tagRules("itemIdentData"),
  renderHTML({ HTMLAttributes }) {
    return ["itemIdentData", mergeAttributes(HTMLAttributes), 0];
  },
});

/** 图解类（IPD）节点。 */
export const s1000dIpdNodes = [
  S1000DHotspot,
  S1000DDescrForPart,
  S1000DPartKeyword,
  S1000DOverLengthPartNumber,
  S1000DQuantityPerNextHigherAssy,
  S1000DTotalQuantity,
  S1000DPartRef,
  S1000DItemIdentData,
  S1000DPartSegment,
  S1000DItemSeqNumber,
  S1000DCatalogSeqNumber,
  S1000DCatalogSeqNumberGroup,
] as const;
