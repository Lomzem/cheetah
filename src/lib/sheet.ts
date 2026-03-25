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

const SHEET_DRAFT_STORAGE_KEY = 'cheetah-sheet-draft'

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

function parseStoredDraft(value: string | null) {
  if (!value) {
    return defaultSheetDraft
  }

  try {
    return sheetDraftSchema.parse(JSON.parse(value))
  } catch {
    return defaultSheetDraft
  }
}

function readActiveDraft() {
  if (typeof window === 'undefined') {
    return defaultSheetDraft
  }

  return parseStoredDraft(window.localStorage.getItem(SHEET_DRAFT_STORAGE_KEY))
}

function writeActiveDraft(draft: SheetDraft) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SHEET_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function useSheetDraft() {
  const [draft, setDraft] = useState<SheetDraft>(defaultSheetDraft)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const existingDraft = readActiveDraft()
    setDraft(existingDraft)
    setReady(true)

    if (existingDraft === defaultSheetDraft) {
      writeActiveDraft(defaultSheetDraft)
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== SHEET_DRAFT_STORAGE_KEY) {
        return
      }

      setDraft(parseStoredDraft(event.newValue))
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const persistDraft = useCallback(
    (updates: Partial<Omit<SheetDraft, 'id' | 'updatedAt'>>) => {
      const currentDraft = readActiveDraft()
      const nextDraft = buildNextDraft(currentDraft, updates)

      writeActiveDraft(nextDraft)
      setDraft(nextDraft)
    },
    [],
  )

  return {
    draft,
    ready,
    persistDraft,
  }
}
