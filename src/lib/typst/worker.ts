import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url'
import { createTypstCompiler, loadFonts } from '@myriaddreamin/typst.ts'
import { CompileFormatEnum } from '@myriaddreamin/typst.ts/compiler'

type CompileMessage = {
  id: number
  source: string
}

type Diagnostic = {
  message: string
  path: string
  range: string
}

type SuccessMessage = {
  id: number
  ok: true
  pdfData: ArrayBuffer
}

type ErrorMessage = {
  id: number
  ok: false
  message: string
  diagnostics?: Diagnostic[]
}

let compilerPromise: Promise<ReturnType<typeof createTypstCompiler>> | undefined
let compilerQueue = Promise.resolve()

async function getCompiler() {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      const compiler = createTypstCompiler()
      await compiler.init({
        getModule: () => ({ module_or_path: compilerWasmUrl }),
        beforeBuild: [loadFonts([], { assets: ['text'] })],
      })
      return compiler
    })()
  }

  return compilerPromise
}

function withCompilerLock<T>(
  task: (compiler: ReturnType<typeof createTypstCompiler>) => Promise<T>,
) {
  const result = compilerQueue.then(async () => task(await getCompiler()))
  compilerQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

function toErrorMessage(id: number, error: unknown): ErrorMessage {
  return {
    id,
    ok: false,
    message:
      error instanceof Error
        ? error.message
        : 'Unable to compile the document.',
  }
}

self.onmessage = async (event: MessageEvent<CompileMessage>) => {
  const { id, source } = event.data

  try {
    const result = await withCompilerLock(async (compiler) => {
      await compiler.reset()
      compiler.addSource('/main.typ', source)

      return compiler.compile({
        mainFilePath: '/main.typ',
        format: CompileFormatEnum.pdf,
        diagnostics: 'full',
      })
    })

    if (!result.result) {
      const diagnostics = result.diagnostics?.map((diagnostic) => ({
        message: diagnostic.message,
        path: diagnostic.path,
        range: diagnostic.range,
      }))

      const message: ErrorMessage = {
        id,
        ok: false,
        message: diagnostics?.[0]?.message ?? 'Unable to compile the document.',
        diagnostics,
      }

      self.postMessage(message)
      return
    }

    const pdfData = result.result.slice().buffer
    const message: SuccessMessage = {
      id,
      ok: true,
      pdfData,
    }

    postMessage(message, { transfer: [pdfData] })
  } catch (error) {
    self.postMessage(toErrorMessage(id, error))
  }
}
