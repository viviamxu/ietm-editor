import { create } from 'zustand'

import defaultDescriptionSchema from '../data/描述类Schema.json'
import type { DescriptionSchema } from '../types/descriptionSchema'

const DEFAULT_SCHEMA = defaultDescriptionSchema as DescriptionSchema

type DescriptionSchemaState = {
  schema: DescriptionSchema
  setDescriptionSchema: (next: DescriptionSchema) => void
  resetDescriptionSchema: () => void
}

export const useDescriptionSchemaStore = create<DescriptionSchemaState>(
  (set) => ({
    schema: DEFAULT_SCHEMA,
    setDescriptionSchema: (next) => set({ schema: next }),
    resetDescriptionSchema: () => set({ schema: DEFAULT_SCHEMA }),
  }),
)

/** 非 React 宿主（如 vanilla）可直接调用 */
export function getDescriptionSchema(): DescriptionSchema {
  return useDescriptionSchemaStore.getState().schema
}

export function setDescriptionSchema(next: DescriptionSchema): void {
  useDescriptionSchemaStore.getState().setDescriptionSchema(next)
}

export function resetDescriptionSchema(): void {
  useDescriptionSchemaStore.getState().resetDescriptionSchema()
}
