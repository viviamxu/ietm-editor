import ListItem from '@tiptap/extension-list-item'

/** S1000D `listItem` 内容为 `para+`（与描述类 schema 一致，不再使用 StarterKit `paragraph`） */
export const S1000DListItem = ListItem.extend({
  name: 'listItem',
  content: 'para+',
})
