/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Demo：后端 API 根路径，配置后底栏「预览」走内置 PDF 接口 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.xml?raw' {
  const xml: string
  export default xml
}
