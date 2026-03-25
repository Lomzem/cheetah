import { readFile } from 'node:fs/promises'
import path from 'node:path'
import wasm from '@myriaddreamin/typst-ts-web-compiler/wasm'
import { createTypstCompiler, loadFonts } from '@myriaddreamin/typst.ts'
import { CompileFormatEnum } from '@myriaddreamin/typst.ts/compiler'

type Formula = {
  id: string
  name: string
  typst: string
}

type FormulaClass = {
  categories: Array<{
    formulas: Formula[]
  }>
}

const files = [
  'formula-data/pre-algebra.json',
  'formula-data/algebra-i.json',
  'formula-data/algebra-ii.json',
  'formula-data/geometry.json',
]

const compiler = createTypstCompiler()

await compiler.init({
  getModule: () => new URL(`file://${wasm}`),
  beforeBuild: [loadFonts([], { assets: ['text'] })],
})

const failures: Array<{ id: string; diagnostics: unknown }> = []

for (const relativePath of files) {
  const absolutePath = path.join(process.cwd(), relativePath)
  const raw = await readFile(absolutePath, 'utf8')
  const data = JSON.parse(raw) as FormulaClass

  for (const category of data.categories) {
    for (const formula of category.formulas) {
      await compiler.reset()
      compiler.addSource(
        '/main.typ',
        `#set page(width: 8.5in, height: auto)\n$ ${formula.typst} $`,
      )

      const result = await compiler.compile({
        mainFilePath: '/main.typ',
        format: CompileFormatEnum.pdf,
        diagnostics: 'full',
      })

      if (!result.result) {
        failures.push({ id: formula.id, diagnostics: result.diagnostics })
      }
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}

console.log('All formulas compiled successfully.')
