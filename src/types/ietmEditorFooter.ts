/**
 * 底栏 `.ietm-app-footer` 状态语义（样式）；文案由宿主传入 {@link IETMEditorFooterStatus.text}。
 */
export type IETMEditorFooterVariant =
  | "saved"
  | "saving"
  | "readonly"
  | "error"
  | "custom";

export interface IETMEditorFooterStatus {
  variant: IETMEditorFooterVariant;
  text: string;
}
