// src/store/dmMetadataStore.ts
import { create } from "zustand";

type DmMetadataState = {
  identAndStatusXml: string;
  setIdentAndStatusXml: (xml: string) => void;
};

export const useDmMetadataStore = create<DmMetadataState>((set) => ({
  identAndStatusXml: "", // 默认空字符串
  setIdentAndStatusXml: (xml) => set({ identAndStatusXml: xml }),
}));
