/** 工具栏「保存」在传入时用于整包 DM XML 的宿主落盘；未传时仍使用浏览器下载。 */
export type SaveDmXmlHandler = (xml: string) => void | Promise<void>;
