import { create } from "zustand";
import { DEFAULT_ICN_INFO_PATH } from "../lib/ietm/icnInfo";

interface IcnInfoConfig {
  apiBaseUrl: string;
  icnInfoPath: string;
  /** `@ietm-manual/preview` 静态资源根路径，传给 `setLibPath` */
  previewLibPath: string;
}

interface IcnInfoState extends IcnInfoConfig {
  setIcnInfoConfig: (config: Partial<IcnInfoConfig>) => void;
}

export const useIcnInfoStore = create<IcnInfoState>((set) => ({
  apiBaseUrl: "",
  icnInfoPath: DEFAULT_ICN_INFO_PATH,
  previewLibPath: "/",
  setIcnInfoConfig: (config) => set(config),
}));
