import { z } from 'zod'
import { getSelectedFormulaGroups } from './formulas/data'
import { columnCountSchema, layoutModeSchema } from './sheet'

export const compileRequestSchema = z.object({
  title: z.string().min(1).max(80),
  selectedFormulaIds: z.array(z.string()),
  columnCount: columnCountSchema,
  layoutMode: layoutModeSchema,
  noteText: z.string().max(3000),
})

export type CompileRequest = z.infer<typeof compileRequestSchema>

function escapeLatexText(input: string) {
  return Array.from(input)
    .map((char) => {
      switch (char) {
        case '\\':
          return '\\textbackslash{}\\allowbreak{}'
        case '&':
          return '\\&'
        case '%':
          return '\\%'
        case '$':
          return '\\$'
        case '#':
          return '\\#'
        case '_':
          return '\\_\\allowbreak{}'
        case '{':
          return '\\{'
        case '}':
          return '\\}'
        case '~':
          return '\\textasciitilde{}\\allowbreak{}'
        case '^':
          return '\\textasciicircum{}\\allowbreak{}'
        case '/':
          return '/\\allowbreak{}'
        case '-':
          return '-\\allowbreak{}'
        case '.':
          return '.\\allowbreak{}'
        case ',':
          return ',\\allowbreak{}'
        case ':':
          return ':\\allowbreak{}'
        case ';':
          return ';\\allowbreak{}'
        case ')':
          return ')\\allowbreak{}'
        case ']':
          return ']\\allowbreak{}'
        default:
          return char
      }
    })
    .join('')
}

function renderNotes(noteText: string) {
  const trimmed = noteText.trim()
  if (!trimmed) {
    return ''
  }

  const blocks = trimmed.split(/\n\s*\n/)
  const renderedBlocks = blocks.map((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)

    if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => line.replace(/^[-*]\s+/, ''))
        .map((line) => `\\item \\sheetwrap{${escapeLatexText(line)}}`)
        .join('\n')

      return `\\begin{itemize}[leftmargin=1.2em,itemsep=0.15em,topsep=0.25em,parsep=0pt]\n${items}\n\\end{itemize}`
    }

    return `\\sheetparagraph{${lines.map((line) => escapeLatexText(line)).join('\\\\\n')}}`
  })

  return renderedBlocks.join('\n\n\\medskip\n\n')
}

function renderFormulaGroups(selectedFormulaIds: string[]) {
  const groups = getSelectedFormulaGroups(selectedFormulaIds)

  return groups
    .map((classData) => {
      const categories = classData.categories
        .map((category) => {
          const formulas = category.formulas
            .map(
              (formula) =>
                `\\formulaentry{${escapeLatexText(formula.name)}}{${formula.latex}}`,
            )
            .join('\n')

          return `\\categoryheader{${escapeLatexText(category.name)}}\n${formulas}`
        })
        .join('\n\n')

      return `\\classheader{${escapeLatexText(classData.name)}}\n${categories}`
    })
    .join('\n\n')
}

export function renderLatexDocument(request: CompileRequest) {
  const data = compileRequestSchema.parse(request)
  const formulaBody = renderFormulaGroups(data.selectedFormulaIds)
  const notes = renderNotes(data.noteText)
  const fontSize = data.layoutMode === 'compact' ? '8pt' : '9pt'
  const columnSep = data.layoutMode === 'compact' ? '0.16in' : '0.22in'
  const formulaSpacing = data.layoutMode === 'compact' ? '0.3em' : '0.48em'
  const content = [
    formulaBody || '',
    notes ? `\\classheader{Notes}\n${notes}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const body =
    data.columnCount === 1
      ? content
      : `\\begin{multicols*}{${data.columnCount}}\n\\raggedcolumns\n${content}\n\\end{multicols*}`

  return String.raw`\documentclass[letterpaper,${fontSize}]{extarticle}
\usepackage[margin=0.35in]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage{amsmath,amssymb,mathtools,multicol,enumitem,ragged2e,adjustbox}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlength{\columnsep}{${columnSep}}
\setlength{\abovedisplayskip}{2pt}
\setlength{\belowdisplayskip}{2pt}
\setlength{\abovedisplayshortskip}{1pt}
\setlength{\belowdisplayshortskip}{1pt}
\setlength{\emergencystretch}{1.5em}
\setlist[itemize]{leftmargin=1.1em,itemsep=0.15em,topsep=0.25em,parsep=0pt}
\definecolor{sheetink}{HTML}{1F2937}
\definecolor{sheetmuted}{HTML}{6B7280}
\definecolor{sheetline}{HTML}{D1D5DB}
\newcommand{\sheetwrap}[1]{{\RaggedRight\sloppy #1}}
\newcommand{\sheetparagraph}[1]{\begingroup\RaggedRight\sloppy #1\par\endgroup}
\newcommand{\sheetlabel}[1]{\begingroup\RaggedRight\sloppy\bfseries #1\par\endgroup}
\newcommand{\classheader}[1]{\vspace{0.2em}{\large\bfseries\color{sheetink}\sheetwrap{#1}\par}\vspace{0.3em}\hrule\vspace{0.45em}}
\newcommand{\categoryheader}[1]{\section*{\sheetwrap{#1}}}
\newcommand{\formulaentry}[2]{\sheetlabel{#1}\adjustbox{max width=\linewidth}{\ensuremath{\displaystyle #2}}\par\vspace{${formulaSpacing}}}
\begin{document}
${body}
\end{document}
`
}

export function getSelectedFormulaCount(selectedFormulaIds: string[]) {
  return getSelectedFormulaGroups(selectedFormulaIds).reduce(
    (sum, classData) =>
      sum +
      classData.categories.reduce(
        (categorySum, category) => categorySum + category.formulas.length,
        0,
      ),
    0,
  )
}
