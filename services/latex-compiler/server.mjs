import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const HOST = process.env.HOST ?? '0.0.0.0'
const PORT = Number(process.env.PORT ?? 8080)
const TECTONIC_BIN = process.env.TECTONIC_BIN ?? 'tectonic'

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Request body exceeded 1MB limit.'))
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
    })

    let output = ''

    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
        return
      }

      reject(
        new Error(
          output || `${command} exited with code ${code ?? 'unknown'}.`,
        ),
      )
    })
  })
}

async function compileLatex(tex) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tectonic-service-'))
  const texPath = path.join(tempDir, 'sheet.tex')
  const pdfPath = path.join(tempDir, 'sheet.pdf')

  try {
    await writeFile(texPath, tex, 'utf8')

    const logs = await runCommand(
      TECTONIC_BIN,
      ['--keep-logs', '--outdir', tempDir, texPath],
      tempDir,
    )

    const pdf = await readFile(pdfPath)
    const pdfInfo = await runCommand('pdfinfo', [pdfPath], tempDir)
    const pageCount = Number(pdfInfo.match(/^Pages:\s+(\d+)/m)?.[1] ?? '0')

    return {
      ok: true,
      pdfBase64: pdf.toString('base64'),
      logs,
      pageCount,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    json(response, 400, { ok: false, message: 'Missing request URL.' })
    return
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    })
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { ok: true, service: 'tectonic-compiler' })
    return
  }

  if (request.method !== 'POST' || request.url !== '/compile') {
    json(response, 404, { ok: false, message: 'Not found.' })
    return
  }

  try {
    const rawBody = await collectRequestBody(request)
    const body = JSON.parse(rawBody)

    if (!body || typeof body.tex !== 'string' || body.tex.trim().length === 0) {
      json(response, 400, {
        ok: false,
        message: 'Expected a non-empty `tex` string.',
      })
      return
    }

    const result = await compileLatex(body.tex)
    json(response, 200, result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected compiler failure.'
    json(response, 500, { ok: false, message, logs: message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Tectonic compiler listening on http://${HOST}:${PORT}`)
})
