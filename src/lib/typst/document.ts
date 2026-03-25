import { z } from 'zod'
import { getSelectedFormulaGroups } from '#/lib/formulas/data'
import { columnCountSchema, layoutModeSchema } from '#/lib/sheet'

export const compileRequestSchema = z.object({
  title: z.string().min(1).max(80),
  selectedFormulaIds: z.array(z.string()),
  columnCount: columnCountSchema,
  layoutMode: layoutModeSchema,
  noteText: z.string().max(3000),
})

export type CompileRequest = z.infer<typeof compileRequestSchema>

function escapeTypstText(input: string) {
  return input
    .replaceAll('\\', '\\\\')
    .replaceAll('#', '\\#')
    .replaceAll('<', '\\<')
    .replaceAll('>', '\\>')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('*', '\\*')
    .replaceAll('_', '\\_')
    .replaceAll('`', '\\`')
    .replaceAll('$', '\\$')
}

const textHeavySymbolMap = new Map([
  ['arrow.r', '#sym.arrow.r'],
  ['arrow.r.double', '#sym.arrow.r.double'],
  ['arrow.l.r.double', '#sym.arrow.l.r.double'],
  ['degree', '#sym.degree'],
  ['infinity', '#sym.infinity'],
  ['perp', '#sym.perp'],
])

function renderNotes(noteText: string) {
  const trimmed = noteText.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return lines
          .map((line) => `- ${escapeTypstText(line.replace(/^[-*]\s+/, ''))}`)
          .join('\n')
      }

      return escapeTypstText(lines.join(' '))
    })
    .join('\n\n')
}

function isTextHeavyFormula(formula: string) {
  if (!/^\s*"/.test(formula)) {
    return false
  }

  const unquoted = formula.replace(/"[^"]*"/g, ' ')
  const probe = unquoted
    .replace(/\b(?:arrow(?:\.[a-z]+)*|degree|infinity|perp)\b/g, ' ')
    .replace(/[,:;()[\]{}]/g, ' ')
    .trim()

  return probe.length === 0
}

function renderTextHeavyFormula(formula: string) {
  return formula.replaceAll('"', '').replace(/\s+/g, ' ').trim()
}

function renderTextHeavyFormulaBlock(formula: string) {
  return renderTextHeavyFormula(formula)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => textHeavySymbolMap.get(token) ?? escapeTypstText(token))
    .join(' ')
}

export function renderFormula(formula: { name: string; typst: string }) {
  if (isTextHeavyFormula(formula.typst)) {
    return `*${escapeTypstText(formula.name)}*
#block(width: 100%)[${renderTextHeavyFormulaBlock(formula.typst)}]`
  }

  return `*${escapeTypstText(formula.name)}*
$ ${formula.typst} $`
}

function renderFormulaGroups(selectedFormulaIds: string[]) {
  return getSelectedFormulaGroups(selectedFormulaIds)
    .map((classData) => {
      const categories = classData.categories
        .map((category) => {
          const formulas = category.formulas.map(renderFormula).join('\n\n')

          return `== ${escapeTypstText(category.name)}\n\n${formulas}`
        })
        .join('\n\n')

      return `= ${escapeTypstText(classData.name)}\n\n${categories}`
    })
    .join('\n\n')
}

export function renderTypstDocument(request: CompileRequest) {
  const data = compileRequestSchema.parse(request)
  const content = [renderFormulaGroups(data.selectedFormulaIds)]
  const notes = renderNotes(data.noteText)

  if (notes) {
    content.push(`= Notes\n\n${notes}`)
  }

  const fontSize = data.layoutMode === 'compact' ? '8pt' : '9pt'
  const body =
    content.filter(Boolean).join('\n\n') || 'Select formulas or add notes.'

  return `#set page(paper: "us-letter", margin: 0.35in, columns: ${data.columnCount})
#set text(size: ${fontSize}, fill: rgb("#1F2937"))
#set par(justify: false, leading: 0.45em)
#set heading(numbering: none)
#show heading.where(level: 1): set text(size: 11pt, weight: "bold", fill: rgb("#1F2937"))
#show heading.where(level: 2): set text(size: 9pt, weight: "semibold", fill: rgb("#6B7280"))

${body}
`
}
