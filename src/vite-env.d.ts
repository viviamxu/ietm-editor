/// <reference types="vite/client" />

declare module '*.xml?raw' {
  const xml: string
  export default xml
}
