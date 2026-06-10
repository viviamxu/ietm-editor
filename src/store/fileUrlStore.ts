import { create } from "zustand";

interface FileUrlState {
  /** 媒体文件 URL 前缀；打开 XML 时与相对 `xlink:href` 拼接为完整路径。 */
  fileUrlPrefix: string;
  setFileUrlPrefix: (prefix: string) => void;
}

export const useFileUrlStore = create<FileUrlState>((set) => ({
  fileUrlPrefix: "",
  setFileUrlPrefix: (prefix) => set({ fileUrlPrefix: prefix }),
}));

export function getFileUrlPrefix(): string {
  return useFileUrlStore.getState().fileUrlPrefix;
}
