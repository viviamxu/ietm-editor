import { Loader } from "lucide-react";

interface DmPdfPreviewPaneProps {
  loading: boolean;
  error: string | null;
  pdfUrl: string | null;
}

export function DmPdfPreviewPane(props: DmPdfPreviewPaneProps) {
  const { loading, error, pdfUrl } = props;

  if (loading) {
    return (
      <div className="ietm-pdf-preview-pane ietm-pdf-preview-pane--loading">
        <Loader
          size={24}
          aria-hidden
          className="ietm-pdf-preview-pane__spinner shrink-0"
        />
        <p>正在保存并加载预览…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ietm-pdf-preview-pane ietm-pdf-preview-pane--error">
        <p>{error}</p>
      </div>
    );
  }

  if (pdfUrl) {
    return (
      <iframe
        className="ietm-pdf-preview-frame"
        src={pdfUrl}
        title="DM PDF 预览"
      />
    );
  }

  return (
    <div className="ietm-preview-placeholder">
      <p>点击底栏预览按钮加载 PDF</p>
    </div>
  );
}
