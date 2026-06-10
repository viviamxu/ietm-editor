import { Message } from "@arco-design/web-react";
import type { Editor } from "@tiptap/core";

import { parseDmRefDisplayMeta } from "../../extensions/s1000d/dmRefDisplay";
import { useToolbarConfigStore } from "../../store/toolbarConfigStore";
import type { OpenExternalRefContext } from "../../types/toolbar";

import { armInternalRefJumpGuard } from "./internalRefNavigate";

/** 打开外部引用指向的出版物（宿主实现新窗口加载 DM XML；未配置时 mock 提示）。 */
export function openExternalRefPublication(
  editor: Editor,
  attrs: {
    rawXml?: string | null;
    displayCode?: string | null;
    refTargetId?: string | null;
  },
): void {
  const rawXml = String(attrs.rawXml ?? "").trim();
  if (!rawXml) return;

  const meta = parseDmRefDisplayMeta(rawXml, attrs.displayCode);
  const refTargetId = String(attrs.refTargetId ?? "").trim() || null;
  const ctx: OpenExternalRefContext = {
    editor,
    rawXml,
    title: meta.title,
    code: meta.code,
    refTargetId,
    dmCode: meta.dmCode,
    issueInfo: meta.issueInfo,
    language: meta.language,
  };

  armInternalRefJumpGuard();

  const handler = useToolbarConfigStore.getState().onOpenExternalRefTarget;
  if (handler) {
    void Promise.resolve(handler(ctx));
    return;
  }

  Message.info(
    `打开出版物（演示）：${meta.code}${meta.title && meta.title !== meta.code ? ` · ${meta.title}` : ""}`,
  );
}
