import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { CompileRequest } from '#/lib/latex'
import { renderLatexDocument } from '#/lib/latex'

const REMOTE_COMPILER_URL = process.env.LATEX_COMPILER_URL
const TECTONIC_BIN = process.env.TECTONIC_BIN ?? 'tectonic'
const MAX_PAGE_COUNT = 2

export type CompileResult = {
  ok: boolean
  tex: string
  layoutMode: CompileRequest['layoutMode']
  pdfBase64?: string
  pageCount?: number
  overflow?: boolean
  message?: string
  logs?: string
  compilerMode: 'remote' | 'local'
}

type RemoteCompileResponse = {
  ok: boolean
  pdfBase64?: string
  logs?: string
  message?: string
  pageCount?: number
}

async function getPdfPageCount(pdfBuffer: Buffer) {
  const document = await getDocument({ data: new Uint8Array(pdfBuffer) })
    .promise
  const pageCount = document.numPages
  await document.destroy()
  return pageCount
}

async function compileWithRemoteService(
  tex: string,
  layoutMode: CompileRequest['layoutMode'],
): Promise<CompileResult> {
  const response = await fetch(REMOTE_COMPILER_URL!, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ tex }),
  })

  if (!response.ok) {
    return {
      ok: false,
      tex,
      layoutMode,
      compilerMode: 'remote',
      message: 'Compiler unavailable.',
    }
  }

  const result = (await response.json()) as RemoteCompileResponse
  return {
    ...result,
    tex,
    layoutMode,
    overflow: Boolean(result.pageCount && result.pageCount > MAX_PAGE_COUNT),
    compilerMode: 'remote',
  }
}

async function compileWithLocalTectonic(
  tex: string,
  layoutMode: CompileRequest['layoutMode'],
): Promise<CompileResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cheetah-'))
  const texPath = path.join(tempDir, 'sheet.tex')
  const pdfPath = path.join(tempDir, 'sheet.pdf')

  try {
    await writeFile(texPath, tex, 'utf8')

    const logs = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        TECTONIC_BIN,
        ['--keep-logs', '--outdir', tempDir, texPath],
        {
          cwd: tempDir,
          env: process.env,
        },
      )

      let output = ''

      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
      })

      child.stderr.on('data', (chunk) => {
        output += chunk.toString()
      })

      child.on('error', (error) => reject(error))
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output)
          return
        }

        reject(
          new Error(
            output || `Tectonic exited with code ${code ?? 'unknown'}.`,
          ),
        )
      })
    })

    const pdfBuffer = await readFile(pdfPath)
    const pageCount = await getPdfPageCount(pdfBuffer)

    return {
      ok: true,
      tex,
      layoutMode,
      pdfBase64: pdfBuffer.toString('base64'),
      logs,
      pageCount,
      overflow: pageCount > MAX_PAGE_COUNT,
      compilerMode: 'local',
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to compile the document.'

    return {
      ok: false,
      tex,
      layoutMode,
      compilerMode: 'local',
      message:
        message.includes('ENOENT') || message.includes('not found')
          ? 'Tectonic is not installed. Set `LATEX_COMPILER_URL` for a remote compiler or install `tectonic` locally to enable PDF preview.'
          : message,
      logs: message,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function compileSheet(
  request: CompileRequest,
): Promise<CompileResult> {
  const tex = renderLatexDocument(request)

  if (REMOTE_COMPILER_URL) {
    const initial = await compileWithRemoteService(tex, request.layoutMode)
    if (
      initial.ok &&
      initial.overflow &&
      request.layoutMode === 'comfortable'
    ) {
      const compactRequest = { ...request, layoutMode: 'compact' as const }
      const compact = await compileWithRemoteService(
        renderLatexDocument(compactRequest),
        'compact',
      )
      return {
        ...compact,
        layoutMode: compact.ok ? 'compact' : initial.layoutMode,
      }
    }

    return initial
  }

  const initial = await compileWithLocalTectonic(tex, request.layoutMode)
  if (initial.ok && initial.overflow && request.layoutMode === 'comfortable') {
    const compactRequest = { ...request, layoutMode: 'compact' as const }
    const compact = await compileWithLocalTectonic(
      renderLatexDocument(compactRequest),
      'compact',
    )
    return {
      ...compact,
      layoutMode: compact.ok ? 'compact' : initial.layoutMode,
    }
  }

  return initial
}
