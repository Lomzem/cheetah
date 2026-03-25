import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import {
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathFormula } from '#/components/math-formula'
import {
  getFormulaClasses,
  getFormulaIndex,
  getFormulaStats,
  getSelectedFormulaGroups,
} from '#/lib/formulas/data'
import type { CompileRequest } from '#/lib/latex'
import { renderLatexDocument } from '#/lib/latex'
import type { SheetDraft } from '#/lib/sheet'
import {
  buildNextDraft,
  defaultSheetDraft,
  sheetDraftCollection,
} from '#/lib/sheet'
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
const formulaStats = getFormulaStats()

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
  const requestCounter = useRef(0)

  const { data } = useLiveQuery(() => sheetDraftCollection)
  const draft = data?.[0] ?? defaultSheetDraft

  useEffect(() => {
    if (data && data.length === 0) {
      sheetDraftCollection.insert(defaultSheetDraft)
    }
  }, [data])

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
  }, [request, signature])

  useEffect(() => {
    if (!previewState.result?.ok || !previewState.result.pdfBase64) {
      setPdfUrl(undefined)
      return
    }

    const url = URL.createObjectURL(
      base64ToBlob(previewState.result.pdfBase64, 'application/pdf'),
    )
    setPdfUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [previewState.result])

  function persistDraft(
    updates: Partial<Omit<SheetDraft, 'id' | 'updatedAt'>>,
  ) {
    const nextDraft = buildNextDraft(draft, updates)

    if (data && data.length > 0) {
      sheetDraftCollection.update('active', (current) => {
        Object.assign(current, nextDraft)
      })
      return
    }

    sheetDraftCollection.insert(nextDraft)
  }

  function toggleFormula(formulaId: string) {
    const nextSelected = draft.selectedFormulaIds.includes(formulaId)
      ? draft.selectedFormulaIds.filter((id) => id !== formulaId)
      : [...draft.selectedFormulaIds, formulaId]

    persistDraft({ selectedFormulaIds: nextSelected })
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white/85 shadow-[0_32px_90px_-54px_rgba(120,53,15,0.42)] backdrop-blur">
        <div className="grid gap-8 p-6 lg:grid-cols-[1.35fr_0.95fr] lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-700">
              Equation Builder
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              Assemble a one-page math cheat sheet with clicks instead of LaTeX.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
              Pick formulas by class, choose a column layout, drop in simple
              notes, and keep a live PDF preview in sync with the generated
              source.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Classes', String(formulaStats.classCount)],
              ['Categories', String(formulaStats.categoryCount)],
              ['Formulas', String(formulaStats.formulaCount)],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-[1.5rem] border border-orange-100 bg-orange-50/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-orange-800">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-stone-900">
                  {value}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.85fr_1fr]">
        <section className="rounded-[2rem] border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-stone-200 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              {formulaIndex.classes.map((classData) => (
                <button
                  key={classData.id}
                  type="button"
                  onClick={() => setActiveClassId(classData.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeClassId === classData.id
                      ? 'bg-stone-900 text-stone-50'
                      : 'bg-stone-100 text-stone-600 hover:bg-orange-100 hover:text-stone-900'
                  }`}
                >
                  {classData.name}
                </button>
              ))}
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search formulas, classes, or categories"
                className="w-full rounded-full border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white"
              />
            </label>
          </div>

          <div className="mt-5 space-y-4">
            {visibleClasses.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
                No formulas matched your search.
              </div>
            ) : (
              visibleClasses.map((classData) => (
                <div key={classData.id} className="space-y-3">
                  {classData.categories.map((category) => (
                    <details
                      key={category.id}
                      open
                      className="rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-4"
                    >
                      <summary className="cursor-pointer list-none text-sm font-semibold text-stone-900">
                        <div className="flex items-center justify-between gap-3">
                          <span>{category.name}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-stone-500">
                            {category.formulas.length}
                          </span>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-3">
                        {category.formulas.map((formula) => {
                          const selected = draft.selectedFormulaIds.includes(
                            formula.id,
                          )

                          return (
                            <label
                              key={formula.id}
                              className={`block cursor-pointer rounded-[1.35rem] border p-4 transition ${
                                selected
                                  ? 'border-orange-300 bg-orange-50 shadow-sm'
                                  : 'border-stone-200 bg-white hover:border-stone-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleFormula(formula.id)}
                                  className="mt-1 h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-400"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-stone-900">
                                      {formula.name}
                                    </p>
                                    {selected ? (
                                      <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-50">
                                        Included
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-stone-700">
                                    <MathFormula latex={formula.latex} />
                                  </div>
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6 rounded-[2rem] border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Sheet Controls
                </p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-900">
                  Tune the page.
                </h2>
              </div>
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
                className="rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
              >
                Reset
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Sheet title
                </span>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    persistDraft({ title: event.target.value.slice(0, 80) })
                  }
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:bg-white"
                />
              </label>

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Columns</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() =>
                        persistDraft({ columnCount: count as 1 | 2 | 3 })
                      }
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        draft.columnCount === count
                          ? 'bg-orange-600 text-orange-50 shadow-sm'
                          : 'bg-stone-100 text-stone-600 hover:bg-orange-100 hover:text-stone-900'
                      }`}
                    >
                      {count} col{count === 1 ? '' : 's'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-stone-700">
                  Notes
                </span>
                <textarea
                  value={draft.noteText}
                  onChange={(event) =>
                    persistDraft({
                      noteText: event.target.value.slice(0, 3000),
                    })
                  }
                  rows={10}
                  placeholder="Add reminders, quick definitions, or bullet lists.

- Bullet point example
- Another study note"
                  className="w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white"
                />
                <p className="text-xs text-stone-500">
                  Blank lines create paragraph breaks. Lines starting with `-`
                  become bullets.
                </p>
              </label>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Selection
                </p>
                <h3 className="mt-2 text-lg font-semibold text-stone-900">
                  {selectedCount} formulas selected
                </h3>
              </div>
              <Sparkles className="h-5 w-5 text-orange-500" />
            </div>

            <div className="mt-4 max-h-[26rem] space-y-4 overflow-auto pr-1">
              {selectedGroups.length === 0 ? (
                <p className="text-sm leading-7 text-stone-500">
                  Pick formulas from the browser to start your cheat sheet.
                </p>
              ) : (
                selectedGroups.map((classData) => (
                  <div key={classData.id} className="space-y-3">
                    <div>
                      <p className="font-serif text-xl font-semibold text-stone-900">
                        {classData.name}
                      </p>
                    </div>
                    {classData.categories.map((category) => (
                      <div key={category.id}>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                          {category.name}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {category.formulas.map((formula) => (
                            <button
                              key={formula.id}
                              type="button"
                              onClick={() => toggleFormula(formula.id)}
                              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-orange-300 hover:text-stone-900"
                            >
                              {formula.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Live Preview
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-900">
                PDF output
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadTex}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-900"
              >
                <FileText className="h-4 w-4" />
                Download .tex
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
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isDownloadingPdf ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-600">
                {draft.columnCount} column{draft.columnCount === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-600">
                {selectedCount} formulas
              </span>
              {previewResult?.layoutMode === 'compact' ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
                  Compact fallback applied
                </span>
              ) : null}
              {previewResult?.pageCount ? (
                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-600">
                  {previewResult.pageCount} page
                  {previewResult.pageCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
              {previewState.status === 'loading' ? (
                <span className="inline-flex items-center gap-2 text-stone-700">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Rebuilding preview...
                </span>
              ) : previewResult?.overflow ? (
                <span className="text-amber-800">
                  The sheet still spills past one page after compact spacing.
                  Remove formulas or shorten notes to unlock PDF export.
                </span>
              ) : previewUnavailable ? (
                <span>{previewResult?.message}</span>
              ) : previewResult?.ok ? (
                <span className="inline-flex items-center gap-2 text-emerald-700">
                  <Eye className="h-4 w-4" />
                  Preview ready. Download the exact `.tex` used for this render.
                </span>
              ) : (
                <span>
                  Preview will appear automatically after you make changes.
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-inner">
              {pdfUrl && previewResult?.ok && !previewResult.overflow ? (
                <iframe
                  key={pdfUrl}
                  title="Cheat sheet preview"
                  src={pdfUrl}
                  className="h-[48rem] w-full bg-white"
                />
              ) : (
                <div className="flex h-[48rem] items-center justify-center bg-[linear-gradient(180deg,#fff_0%,#faf6ef_100%)] p-8 text-center text-sm text-stone-500">
                  <div className="max-w-sm space-y-3">
                    <p className="font-serif text-2xl font-semibold text-stone-900">
                      Preview waiting on a compiler.
                    </p>
                    <p>
                      This app is wired for Tectonic. Set `LATEX_COMPILER_URL`
                      or install `tectonic` locally to turn the live PDF pane
                      on.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {previewResult?.logs ? (
              <details className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-stone-700">
                  Compiler details
                </summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-stone-600">
                  {previewResult.logs}
                </pre>
              </details>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}
