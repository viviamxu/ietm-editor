import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

const CREW_CHALLENGE_AND_RESPONSE_TYPES = new Set([
  "challengeAndResponse",
  "challenge",
  "response",
]);

/** 光标是否在 `challengeAndResponse` / `challenge` / `response` 内。 */
export function isInsideCrewChallengeAndResponse($from: ResolvedPos): boolean {
  for (let d = $from.depth; d >= 0; d--) {
    if (CREW_CHALLENGE_AND_RESPONSE_TYPES.has($from.node(d).type.name)) {
      return true;
    }
  }
  return false;
}

/** 检查/响应内仅允许编辑 para / fmft；禁止插入 crew 步骤级块、attention 块. */
export function canInsertCrewStepLevelBlockAtCursor(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  return !isInsideCrewChallengeAndResponse(editor.state.selection.$from);
}
