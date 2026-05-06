import { useEffect, useRef } from 'react'
import './App.css'
import { createIETMEditor, type IETMEditorInstance } from './index'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<IETMEditorInstance | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const instance = createIETMEditor({
      element: el,
    })
    instanceRef.current = instance

    const offUpdate = instance.on('update', ({ json }) => {
      // 演示 update 事件：打印根节点子项数量
      console.debug('[ietm] update, blocks:', json.content?.length ?? 0)
    })
    const offReady = instance.on('ready', () => {
      console.debug('[ietm] ready')
    })

    return () => {
      offUpdate()
      offReady()
      instance.destroy()
      if (instanceRef.current === instance) {
        instanceRef.current = null
      }
    }
  }, [])

  return (
    <main className="ietm-demo-shell">
      <div ref={containerRef} className="ietm-demo-mount" />
    </main>
  )
}

export default App
