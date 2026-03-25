import { createCollection, localStorageCollectionOptions } from '@tanstack/db'
import { z } from 'zod'

export const columnCountSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
])
export const layoutModeSchema = z.union([
  z.literal('comfortable'),
  z.literal('compact'),
])

export const sheetDraftSchema = z.object({
  id: z.literal('active'),
  title: z.string().min(1).max(80),
  columnCount: columnCountSchema,
  layoutMode: layoutModeSchema,
  selectedFormulaIds: z.array(z.string()),
  noteText: z.string().max(3000),
  updatedAt: z.string(),
})

export type SheetDraft = z.infer<typeof sheetDraftSchema>
export type ColumnCount = z.infer<typeof columnCountSchema>
export type LayoutMode = z.infer<typeof layoutModeSchema>

export const defaultSheetDraft: SheetDraft = {
  id: 'active',
  title: 'Equation Cheat Sheet',
  columnCount: 2,
  layoutMode: 'comfortable',
  selectedFormulaIds: [],
  noteText: '',
  updatedAt: new Date(0).toISOString(),
}

export const sheetDraftCollection = createCollection(
  localStorageCollectionOptions({
    id: 'sheet-draft',
    storageKey: 'cheetah-sheet-draft',
    getKey: (item) => item.id,
    schema: sheetDraftSchema,
  }),
)

export function buildNextDraft(
  currentDraft: SheetDraft | undefined,
  updates: Partial<Omit<SheetDraft, 'id' | 'updatedAt'>>,
): SheetDraft {
  return {
    ...(currentDraft ?? defaultSheetDraft),
    ...updates,
    id: 'active',
    updatedAt: new Date().toISOString(),
  }
}
