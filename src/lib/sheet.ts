import { createCollection, localStorageCollectionOptions } from '@tanstack/db'
import { useCallback, useEffect, useState } from 'react'
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

function readActiveDraft() {
  return sheetDraftCollection.get('active') ?? defaultSheetDraft
}

export function useSheetDraft() {
  const [draft, setDraft] = useState<SheetDraft>(defaultSheetDraft)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const existingDraft = readActiveDraft()

    if (!sheetDraftCollection.get('active')) {
      sheetDraftCollection.insert(defaultSheetDraft)
    }

    setDraft(existingDraft)
    setReady(true)

    const subscription = sheetDraftCollection.subscribeChanges(() => {
      setDraft(readActiveDraft())
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const persistDraft = useCallback(function persistDraft(
    updates: Partial<Omit<SheetDraft, 'id' | 'updatedAt'>>,
  ) {
    const currentDraft = readActiveDraft()
    const nextDraft = buildNextDraft(currentDraft, updates)

    if (sheetDraftCollection.get('active')) {
      sheetDraftCollection.update('active', (storedDraft) => {
        Object.assign(storedDraft, nextDraft)
      })
      return
    }

    sheetDraftCollection.insert(nextDraft)
  }, [])

  return {
    draft,
    ready,
    persistDraft,
  }
}
