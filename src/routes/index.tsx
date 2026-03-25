import { createFileRoute } from '@tanstack/react-router'
import {
  ChevronDown,
  Code,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathFormula } from '#/components/math-formula'
import ThemeToggle from '#/components/ThemeToggle'
import {
  getFormulaClasses,
  getFormulaIndex,
  getSelectedFormulaGroups,
} from '#/lib/formulas/data'
import type { CompileRequest } from '#/lib/latex'
import { renderLatexDocument } from '#/lib/latex'
import type { SheetDraft } from '#/lib/sheet'
import { defaultSheetDraft, useSheetDraft } from '#/lib/sheet'
import { compilePreview } from '#/lib/server/sheet-actions'

export const Route = createFileRoute('/')({ component: Home })

type PreviewResult = Awaited<ReturnType<typeof compilePreview>>

type PreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  signature: string
  result?: PreviewResult
}

const NOTES_DEBOUNCE_MS = 350
const UI_PREFERENCES_STORAGE_KEY = 'cheetah-ui-preferences'

const formulaClasses = getFormulaClasses()
const formulaIndex = getFormulaIndex()

function readUiPreferences() {
  if (typeof window === 'undefined') {
    return {
      activeClassId: formulaClasses[0]?.id ?? '',
      showTex: false,
    }
  }

  try {
    const stored = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY)

    if (!stored) {
      return {
        activeClassId: formulaClasses[0]?.id ?? '',
        showTex: false,
      }
    }

    const parsed = JSON.parse(stored) as {
      activeClassId?: unknown
      showTex?: unknown
    }

    return {
      activeClassId:
        typeof parsed.activeClassId === 'string' &&
        formulaClasses.some(
          (classData) => classData.id === parsed.activeClassId,
        )
          ? parsed.activeClassId
          : (formulaClasses[0]?.id ?? ''),
      showTex: parsed.showTex === true,
    }
  } catch {
    return {
      activeClassId: formulaClasses[0]?.id ?? '',
      showTex: false,
    }
  }
}

function writeUiPreferences(preferences: {
  activeClassId: string
  showTex: boolean
}) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    UI_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences),
  )
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function base64ToBlob(base64: string, type: string) {
  const binary = window.atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new Blob([bytes], { type })
}

function buildCompileRequest(draft: SheetDraft): CompileRequest {
  return {
    title: draft.title,
    selectedFormulaIds: draft.selectedFormulaIds,
    columnCount: draft.columnCount,
    layoutMode: draft.layoutMode,
    noteText: draft.noteText,
  }
}

function Home() {
  const [activeClassId, setActiveClassId] = useState(
    () => readUiPreferences().activeClassId,
  )
  const [search, setSearch] = useState('')
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: 'idle',
    signature: '',
  })
  const [pdfUrl, setPdfUrl] = useState<string>()
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [showTex, setShowTex] = useState(() => readUiPreferences().showTex)
  const [noteInput, setNoteInput] = useState(defaultSheetDraft.noteText)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const requestCounter = useRef(0)

  const { draft, ready, persistDraft } = useSheetDraft()

  useEffect(() => {
    if (!activeClassId && formulaClasses[0]) {
      setActiveClassId(formulaClasses[0].id)
    }
  }, [activeClassId])

  useEffect(() => {
    writeUiPreferences({ activeClassId, showTex })
  }, [activeClassId, showTex])

  useEffect(() => {
    setNoteInput(draft.noteText)
  }, [draft.noteText])

  useEffect(() => {
    if (!ready || noteInput === draft.noteText) {
      return
    }

    const timer = window.setTimeout(() => {
      persistDraft({ noteText: noteInput })
    }, NOTES_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [draft.noteText, noteInput, persistDraft, ready])

  const request = useMemo(() => buildCompileRequest(draft), [draft])
  const signature = useMemo(() => JSON.stringify(request), [request])

  const selectedGroups = useMemo(
    () => getSelectedFormulaGroups(draft.selectedFormulaIds),
    [draft.selectedFormulaIds],
  )

  const visibleClasses = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return formulaClasses
      .filter((classData) => !activeClassId || classData.id === activeClassId)
      .map((classData) => ({
        ...classData,
        categories: classData.categories
          .map((category) => ({
            ...category,
            formulas: category.formulas.filter((formula) => {
              if (!searchTerm) {
                return true
              }

              const haystack = [
                classData.name,
                category.name,
                formula.name,
                formula.latex,
              ]
                .join(' ')
                .toLowerCase()
              return haystack.includes(searchTerm)
            }),
          }))
          .filter((category) => category.formulas.length > 0),
      }))
      .filter((classData) => classData.categories.length > 0)
  }, [activeClassId, search])

  useEffect(() => {
    if (!ready) {
      return
    }

    const timer = window.setTimeout(async () => {
      const requestId = requestCounter.current + 1
      requestCounter.current = requestId
      setPreviewState((current) => ({
        status: 'loading',
        signature,
        result: current.signature === signature ? current.result : undefined,
      }))

      const result = await compilePreview({ data: request })

      if (requestCounter.current !== requestId) {
        return
      }

      setPreviewState({
        status: result.ok ? 'ready' : 'error',
        signature,
        result,
      })
    }, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [ready, request, signature])

  useEffect(() => {
    if (!previewState.result?.ok || !previewState.result.pdfBase64) {
      return
    }

    const url = URL.createObjectURL(
      base64ToBlob(previewState.result.pdfBase64, 'application/pdf'),
    )
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }, [previewState.result])

  const activeClassFormulaIds = useMemo(() => {
    const classData = formulaClasses.find((c) => c.id === activeClassId)
    if (!classData) return []
    return classData.categories.flatMap((cat) => cat.formulas.map((f) => f.id))
  }, [activeClassId])

  const allClassSelected =
    activeClassFormulaIds.length > 0 &&
    activeClassFormulaIds.every((id) => draft.selectedFormulaIds.includes(id))

  function toggleFormula(formulaId: string) {
    const nextSelected = draft.selectedFormulaIds.includes(formulaId)
      ? draft.selectedFormulaIds.filter((id) => id !== formulaId)
      : [...draft.selectedFormulaIds, formulaId]

    persistDraft({ selectedFormulaIds: nextSelected })
  }

  function toggleIds(ids: string[]) {
    const allSelected = ids.every((id) => draft.selectedFormulaIds.includes(id))
    if (allSelected) {
      const remove = new Set(ids)
      persistDraft({
        selectedFormulaIds: draft.selectedFormulaIds.filter(
          (id) => !remove.has(id),
        ),
      })
    } else {
      const existing = new Set(draft.selectedFormulaIds)
      const added = ids.filter((id) => !existing.has(id))
      persistDraft({
        selectedFormulaIds: [...draft.selectedFormulaIds, ...added],
      })
    }
  }

  function toggleClass() {
    toggleIds(activeClassFormulaIds)
  }

  async function resolvePdfForDownload() {
    if (previewState.signature === signature && previewState.result) {
      return previewState.result
    }

    return compilePreview({ data: request })
  }

  async function handleDownloadPdf() {
    setIsDownloadingPdf(true)

    try {
      const result = await resolvePdfForDownload()
      if (!result.ok || result.overflow || !result.pdfBase64) {
        return
      }

      downloadBlob(
        base64ToBlob(result.pdfBase64, 'application/pdf'),
        `${draft.title || 'cheat-sheet'}.pdf`,
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  function handleDownloadTex() {
    const tex =
      previewState.signature === signature && previewState.result?.tex
        ? previewState.result.tex
        : renderLatexDocument(request)

    downloadBlob(
      new Blob([tex], { type: 'application/x-tex' }),
      `${draft.title || 'cheat-sheet'}.tex`,
    )
  }

  const selectedCount = draft.selectedFormulaIds.length
  const previewResult = previewState.result
  const previewUnavailable =
    previewState.status === 'error' && !previewResult?.pdfBase64

  const texSource =
    previewState.signature === signature && previewResult?.tex
      ? previewResult.tex
      : renderLatexDocument(request)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 lg:px-8">
      {/* ── Top Bar ── */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center gap-4 border-b border-border py-4"
      >
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
          <span className="text-primary">C</span>heetah
        </h1>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Column selector */}
          <div className="flex items-center">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() =>
                  persistDraft({ columnCount: count as 1 | 2 | 3 })
                }
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  draft.columnCount === count
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {count}col
              </button>
            ))}
          </div>

          <span className="mx-1 h-4 w-px bg-border" />

          {/* Downloads */}
          <button
            type="button"
            onClick={handleDownloadTex}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileText className="h-3 w-3" />
            .tex
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={
              isDownloadingPdf ||
              previewState.status === 'loading' ||
              !previewResult ||
              !previewResult.ok ||
              Boolean(previewResult.overflow)
            }
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloadingPdf ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            PDF
          </button>

          <span className="mx-1 h-4 w-px bg-border" />

          <ThemeToggle />
        </div>
      </motion.header>

      {/* ── Workspace ── */}
      <div className="grid flex-1 gap-8 py-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── Left: Builder ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          {/* Notes */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </label>
              <button
                type="button"
                onClick={() => {
                  setNoteInput(defaultSheetDraft.noteText)
                  persistDraft({
                    title: defaultSheetDraft.title,
                    columnCount: defaultSheetDraft.columnCount,
                    layoutMode: defaultSheetDraft.layoutMode,
                    selectedFormulaIds: defaultSheetDraft.selectedFormulaIds,
                    noteText: defaultSheetDraft.noteText,
                  })
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset
              </button>
            </div>
            <textarea
              value={noteInput}
              onChange={(event) =>
                setNoteInput(event.target.value.slice(0, 3000))
              }
              rows={2}
              placeholder="Reminders, bullets (lines starting with -)..."
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
            />
          </div>

          {/* ── Formula Browser ── */}
          <div>
            {/* Class tabs */}
            <LayoutGroup id="class-tabs">
              <div className="flex items-center gap-0.5 border-b border-border">
                {formulaIndex.classes.map((classData) => (
                  <button
                    key={classData.id}
                    type="button"
                    onClick={() => setActiveClassId(classData.id)}
                    className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                      activeClassId === classData.id
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {classData.name}
                    {activeClassId === classData.id ? (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 h-[2px] w-full bg-primary"
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 35,
                        }}
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </LayoutGroup>

            {/* Search + Select All */}
            <div className="flex items-center gap-2 py-3">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                onClick={toggleClass}
                className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {allClassSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Formula list */}
            <div className="max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                {visibleClasses.length === 0 ? (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No formulas matched.
                  </motion.p>
                ) : (
                  <motion.div
                    key={activeClassId}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="space-y-1"
                  >
                    {visibleClasses.map((classData) =>
                      classData.categories.map((category) => {
                        const categoryIds = category.formulas.map((f) => f.id)
                        const allCatSelected =
                          categoryIds.length > 0 &&
                          categoryIds.every((id) =>
                            draft.selectedFormulaIds.includes(id),
                          )
                        const someCatSelected =
                          !allCatSelected &&
                          categoryIds.some((id) =>
                            draft.selectedFormulaIds.includes(id),
                          )

                        return (
                          <details key={category.id} open className="group">
                            <summary className="flex cursor-pointer items-center gap-2 py-2 text-xs font-semibold text-foreground select-none">
                              <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
                              <input
                                type="checkbox"
                                checked={allCatSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someCatSelected
                                }}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  toggleIds(categoryIds)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-3.5 w-3.5"
                              />
                              <span className="flex-1">{category.name}</span>
                              <span className="tabular-nums text-muted-foreground font-normal">
                                {category.formulas.length}
                              </span>
                            </summary>

                            <div className="ml-5 space-y-px pb-1">
                              {category.formulas.map((formula) => {
                                const selected =
                                  draft.selectedFormulaIds.includes(formula.id)

                                return (
                                  <label
                                    key={formula.id}
                                    className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors duration-150 ${
                                      selected
                                        ? 'bg-accent'
                                        : 'hover:bg-secondary'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleFormula(formula.id)}
                                      className="mt-0.5 h-3.5 w-3.5"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        {formula.name}
                                      </p>
                                      <div className="mt-1.5 overflow-x-auto text-foreground">
                                        <MathFormula latex={formula.latex} />
                                      </div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </details>
                        )
                      }),
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Selection summary */}
          <AnimatePresence>
            {selectedGroups.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-border"
              >
                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      <motion.span
                        key={selectedCount}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.1 }}
                        className="inline-block font-display text-primary"
                      >
                        {selectedCount}
                      </motion.span>{' '}
                      formulas on sheet
                    </p>
                    <AnimatePresence mode="wait">
                      {confirmClearAll ? (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.12 }}
                          className="flex items-center gap-1.5"
                        >
                          <span className="text-[11px] text-muted-foreground">
                            Clear all?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              persistDraft({ selectedFormulaIds: [] })
                              setConfirmClearAll(false)
                            }}
                            className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearAll(false)}
                            className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                          >
                            No
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="clear"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.12 }}
                          type="button"
                          onClick={() => setConfirmClearAll(true)}
                          className="group flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear All
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <AnimatePresence>
                      {selectedGroups.flatMap((classData) =>
                        classData.categories.flatMap((category) =>
                          category.formulas.map((formula) => (
                            <motion.button
                              key={formula.id}
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.1 }}
                              type="button"
                              onClick={() => toggleFormula(formula.id)}
                              className="group inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-accent"
                            >
                              {formula.name}
                              <X className="h-2.5 w-2.5 text-muted-foreground group-hover:text-primary" />
                            </motion.button>
                          )),
                        ),
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {/* ── Right: Preview ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
          className="sticky top-6 flex flex-col gap-3 self-start"
        >
          {/* View toggle + status */}
          <div className="flex items-center justify-between">
            <LayoutGroup id="preview-tabs">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowTex(false)}
                  className={`relative inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    !showTex
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {!showTex ? (
                    <motion.div
                      layoutId="preview-tab-bg"
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  ) : null}
                  <Eye className="relative z-10 h-3 w-3" />
                  <span className="relative z-10">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTex(true)}
                  className={`relative inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    showTex
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showTex ? (
                    <motion.div
                      layoutId="preview-tab-bg"
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  ) : null}
                  <Code className="relative z-10 h-3 w-3" />
                  <span className="relative z-10">.tex</span>
                </button>
              </div>
            </LayoutGroup>

            <AnimatePresence mode="wait">
              {previewState.status === 'loading' ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  Compiling
                </motion.span>
              ) : previewResult?.ok && !previewResult.overflow ? (
                <motion.span
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-emerald-600 dark:text-emerald-400"
                >
                  Ready
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {previewResult?.overflow ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-primary"
              >
                Exceeds the two-page limit — remove formulas or shorten notes.
              </motion.p>
            ) : previewUnavailable ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-muted-foreground"
              >
                {previewResult?.message}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Preview frame */}
          <div className="grid overflow-hidden rounded-lg border border-border">
            <motion.pre
              animate={{ opacity: showTex ? 1 : 0 }}
              transition={{ duration: 0.12 }}
              className={`col-start-1 row-start-1 h-[75vh] min-h-[500px] overflow-auto bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground ${showTex ? 'z-10' : 'z-0 pointer-events-none'}`}
            >
              {texSource}
            </motion.pre>

            {pdfUrl ? (
              <motion.div
                animate={{ opacity: showTex ? 0 : 1 }}
                transition={{ duration: 0.12 }}
                className={`relative col-start-1 row-start-1 ${showTex ? 'z-0 pointer-events-none' : 'z-10'}`}
              >
                {previewState.status === 'loading' ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1.5 bg-card/90 py-1 text-xs text-muted-foreground backdrop-blur-sm"
                  >
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    Recompiling
                  </motion.div>
                ) : null}
                <iframe
                  key={pdfUrl}
                  title="Cheat sheet preview"
                  src={pdfUrl}
                  className={`h-[75vh] min-h-[500px] w-full bg-white transition-opacity duration-150 ${previewState.status === 'loading' ? 'opacity-50' : ''}`}
                />
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: showTex ? 0 : 1 }}
                transition={{ duration: 0.12 }}
                className={`dot-bg col-start-1 row-start-1 flex h-[75vh] min-h-[500px] items-center justify-center ${showTex ? 'z-0 pointer-events-none' : 'z-10'}`}
              >
                <div className="text-center">
                  {previewState.status === 'loading' ? (
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <p className="font-display text-sm font-bold text-foreground">
                        No preview yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select formulas to generate a preview.
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
