import type { ReactNode } from "react";
import { Loader } from "lucide-react";

interface DmPdfPreviewPaneProps {
  loading: boolean;
  error: string | null;
  pdfUrl: string | null;
  onDismiss: () => void;
}

export function DmPdfPreviewPane(props: DmPdfPreviewPaneProps) {
  const { loading, error, pdfUrl, onDismiss } = props;

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="ietm-pdf-preview-pane ietm-pdf-preview-pane--loading">
        <Loader
          size={24}
          aria-hidden
          className="ietm-pdf-preview-pane__spinner shrink-0"
        />
        <p>正在加载预览…</p>
      </div>
    );
  } else if (error) {
    body = (
      <div className="ietm-pdf-preview-pane ietm-pdf-preview-pane--error">
        <p>{error}</p>
      </div>
    );
  } else if (pdfUrl) {
    body = (
      <iframe
        className="ietm-pdf-preview-frame"
        src={pdfUrl}
        title="DM PDF 预览"
      />
    );
  } else {
    body = (
      <div className="ietm-preview-placeholder">
        <p>点击底栏预览按钮加载 PDF</p>
      </div>
    );
  }

  return (
    <div className="ietm-preview-panel">
      <div className="ietm-property-panel__head">
        <h2 className="ietm-property-panel__title">预览</h2>
        <button
          type="button"
          className="ietm-property-panel__close"
          onClick={onDismiss}
          aria-label="关闭预览"
        >
          ×
        </button>
      </div>
      <div className="ietm-preview-panel__body">{body}</div>
    </div>
  );
}
