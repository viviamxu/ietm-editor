// src/store/dmMetadataStore.ts
import { create } from "zustand";

type DmMetadataState = {
  identAndStatusXml: string;
  /** 顶栏 `.ietm-doc-title` 展示文案（宿主传入的 XML 文档名，如 `bikeDmSample`） */
  documentDisplayTitle: string;
  setIdentAndStatusXml: (xml: string) => void;
  setDocumentDisplayTitle: (title: string) => void;
};

export const useDmMetadataStore = create<DmMetadataState>((set) => ({
  identAndStatusXml: "",
  documentDisplayTitle: "",
  setIdentAndStatusXml: (xml) => set({ identAndStatusXml: xml }),
  setDocumentDisplayTitle: (title) => set({ documentDisplayTitle: title }),
}));
