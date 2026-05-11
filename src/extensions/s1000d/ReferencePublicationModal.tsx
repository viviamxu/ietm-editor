import { Button, Modal } from '@arco-design/web-react'

import { useInsertPublicationModalStore } from '../../store/insertPublicationModalStore'

export function ReferencePublicationModal() {
  const isOpen = useInsertPublicationModalStore((s) => s.isOpen)
  const closeInsertPublication = useInsertPublicationModalStore(
    (s) => s.closeInsertPublication,
  )

  if (!isOpen) return null

  return (
    <Modal
      title="插入 S1000D 出版物"
      visible={isOpen}
      onCancel={closeInsertPublication}
      footer={
        <Button type="primary" onClick={closeInsertPublication}>
          关闭
        </Button>
      }
      // 强制挂载在 SDK 容器内（若容器不存在则回退到 body）
      getPopupContainer={() =>
        document.getElementById('ietm-sdk-portal-root') || document.body
      }
    >
      <div>ReferencePublicationModal 已通过“插入图片”按钮触发打开。</div>
    </Modal>
  )
}
