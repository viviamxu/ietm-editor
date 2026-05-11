/**
 * 服务端下发的「描述类」元素规则（与 `src/data/描述类Schema.json` 同形）。
 * `content` 为 S1000D 风格的内容模型字符串，供插入逻辑做粗粒度校验与扩展。
 */
export type DescriptionSchemaRule = {
  content?: string
  group?: string
}

export type DescriptionSchema = Record<string, DescriptionSchemaRule>
