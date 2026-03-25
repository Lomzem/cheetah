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
  X,
} from 'lucide-react'
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

const formulaClasses = getFormulaClasses()
const formulaIndex = getFormulaIndex()

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
    formulaClasses[0]?.id ?? '',
  )
  const [search, setSearch] = useState('')
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: 'idle',
    signature: '',
  })
  const [pdfUrl, setPdfUrl] = useState<string>()
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [showTex, setShowTex] = useState(false)
  const requestCounter = useRef(0)

  const { draft, ready, persistDraft } = useSheetDraft()

  useEffect(() => {
    if (!activeClassId && formulaClasses[0]) {
      setActiveClassId(formulaClasses[0].id)
    }
  }, [activeClassId])

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
    const allSelected = ids.every((id) =>
      draft.selectedFormulaIds.includes(id),
    )
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
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-0 px-4 py-6 lg:px-6">
      {/* ── Toolbar ── */}
      <section className="mb-6 flex flex-wrap items-center gap-2">
          {/* Column selector */}
          <div className="flex items-center rounded-lg border border-border bg-card">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() =>
                  persistDraft({ columnCount: count as 1 | 2 | 3 })
                }
                className={`px-3 py-1.5 text-xs font-semibold transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  draft.columnCount === count
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {count} col{count === 1 ? '' : 's'}
              </button>
            ))}
          </div>

          {/* Downloads */}
          <button
            type="button"
            onClick={handleDownloadTex}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <FileText className="h-3.5 w-3.5" />
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloadingPdf ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
      </section>

      {/* ── Workspace: two-panel ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── Left Panel: Formula Browser + Controls ── */}
        <div className="flex flex-col gap-6">
          {/* Sheet config */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-foreground">
                Sheet Settings
              </h2>
              <button
                type="button"
                onClick={() =>
                  persistDraft({
                    title: defaultSheetDraft.title,
                    columnCount: defaultSheetDraft.columnCount,
                    layoutMode: defaultSheetDraft.layoutMode,
                    selectedFormulaIds: defaultSheetDraft.selectedFormulaIds,
                    noteText: defaultSheetDraft.noteText,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="mt-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Notes
                </span>
                <textarea
                  value={draft.noteText}
                  onChange={(event) =>
                    persistDraft({
                      noteText: event.target.value.slice(0, 3000),
                    })
                  }
                  rows={3}
                  placeholder="Reminders, bullets (lines starting with -)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </label>
            </div>
          </div>

          {/* Formula browser */}
          <div className="rounded-xl border border-border bg-card">
            {/* Class tabs + search */}
            <div className="border-b border-border p-4 pb-0">
              <div className="flex flex-wrap items-center gap-1">
                {formulaIndex.classes.map((classData) => (
                  <button
                    key={classData.id}
                    type="button"
                    onClick={() => setActiveClassId(classData.id)}
                    className={`relative rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      activeClassId === classData.id
                        ? 'bg-background text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {classData.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 p-4">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search formulas..."
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                onClick={toggleClass}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                {allClassSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Formula list */}
            <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
              {visibleClasses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-secondary p-6 text-center text-sm text-muted-foreground">
                  No formulas matched your search.
                </div>
              ) : (
                <div className="space-y-3">
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
                      <details
                        key={category.id}
                        open
                        className="group rounded-lg border border-border"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-foreground">
                          <span className="flex items-center gap-2">
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
                              className="h-4 w-4 rounded border-border"
                            />
                            {category.name}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums text-muted-foreground">
                              {category.formulas.length}
                            </span>
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                          </span>
                        </summary>

                        <div className="space-y-1 px-2 pb-2">
                          {category.formulas.map((formula) => {
                            const selected =
                              draft.selectedFormulaIds.includes(formula.id)

                            return (
                              <label
                                key={formula.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                                  selected
                                    ? 'bg-accent'
                                    : 'hover:bg-secondary'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleFormula(formula.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-border"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {formula.name}
                                    </p>
                                    {selected ? (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary dark:bg-primary/20">
                                        Added
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-foreground">
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
                </div>
              )}
            </div>
          </div>

          {/* Selection summary */}
          {selectedGroups.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-sm font-bold text-foreground">
                {selectedCount} formulas on sheet
              </h3>

              <div className="mt-3 space-y-3">
                {selectedGroups.map((classData) => (
                  <div key={classData.id}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {classData.name}
                    </p>
                    {classData.categories.map((category) => (
                      <div key={category.id} className="mt-2">
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          {category.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {category.formulas.map((formula) => (
                            <button
                              key={formula.id}
                              type="button"
                              onClick={() => toggleFormula(formula.id)}
                              className="group inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                            >
                              {formula.name}
                              <X className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Right Panel: Preview / .tex ── */}
        <div className="flex flex-col gap-4">
          {/* Header with view toggle */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setShowTex(false)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      !showTex
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTex(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      showTex
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Code className="h-3.5 w-3.5" />
                    .tex
                  </button>
                </div>
              </div>

              {previewState.status === 'loading' ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Compiling...
                </span>
              ) : previewResult?.ok && !previewResult.overflow ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Eye className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : null}
            </div>

            {previewResult?.overflow ? (
              <p className="mt-2 text-xs text-primary">
                Sheet overflows one page. Remove formulas or shorten notes.
              </p>
            ) : previewUnavailable ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {previewResult?.message}
              </p>
            ) : null}
          </div>

          {/* PDF iframe or .tex source */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {showTex ? (
              <pre className="h-[72vh] min-h-[500px] overflow-auto p-4 font-mono text-[12px] leading-6 text-foreground">
                {texSource}
              </pre>
            ) : pdfUrl ? (
              <>
                {previewState.status === 'loading' ? (
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-secondary/90 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Recompiling...
                  </div>
                ) : null}
                <iframe
                  key={pdfUrl}
                  title="Cheat sheet preview"
                  src={pdfUrl}
                  className={`h-[72vh] min-h-[500px] w-full bg-white ${previewState.status === 'loading' ? 'opacity-50' : ''}`}
                />
              </>
            ) : (
              <div className="dot-bg flex h-[72vh] min-h-[500px] items-center justify-center p-8 text-center">
                <div className="max-w-xs space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                    {previewState.status === 'loading' ? (
                      <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-display text-base font-bold text-foreground">
                    {previewState.status === 'loading' ? 'Compiling...' : 'No preview yet'}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Select some formulas to generate a preview.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
