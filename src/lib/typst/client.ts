type Diagnostic = {
  message: string
  path: string
  range: string
}

type WorkerSuccessMessage = {
  id: number
  ok: true
  pdfData: ArrayBuffer
}

type WorkerErrorMessage = {
  id: number
  ok: false
  message: string
  diagnostics?: Diagnostic[]
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage

type CompileSuccess = {
  ok: true
  pdfData: Uint8Array
}

type CompileFailure = {
  ok: false
  message: string
  diagnostics?: Diagnostic[]
}

export type TypstCompileResult = CompileSuccess | CompileFailure

let worker: Worker | undefined
let nextRequestId = 1
const pending = new Map<
  number,
  {
    resolve: (result: TypstCompileResult) => void
    reject: (error: Error) => void
  }
>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      const request = pending.get(message.id)
      if (!request) {
        return
      }

      pending.delete(message.id)

      if (message.ok) {
        request.resolve({
          ok: true,
          pdfData: new Uint8Array(message.pdfData),
        })
        return
      }

      request.resolve({
        ok: false,
        message: message.message,
        diagnostics: message.diagnostics,
      })
    }

    worker.onerror = (event) => {
      const error = new Error(event.message || 'Typst worker failed.')

      for (const request of pending.values()) {
        request.reject(error)
      }

      pending.clear()
    }
  }

  return worker
}

export function compileTypstPdf(source: string) {
  return new Promise<TypstCompileResult>((resolve, reject) => {
    const requestId = nextRequestId
    nextRequestId += 1

    pending.set(requestId, { resolve, reject })
    getWorker().postMessage({ id: requestId, source })
  })
}
