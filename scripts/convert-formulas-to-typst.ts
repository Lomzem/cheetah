import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Formula = {
  id: string
  name: string
  latex?: string
  typst?: string
}

type FormulaCategory = {
  id: string
  name: string
  formulas: Formula[]
}

type FormulaClass = {
  id: string
  name: string
  categories: FormulaCategory[]
}

const files = [
  'formula-data/pre-algebra.json',
  'formula-data/algebra-i.json',
  'formula-data/algebra-ii.json',
  'formula-data/geometry.json',
]

const manualOverrides = new Map<string, string>([
  [
    'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
    'x = (-b plus.minus sqrt(b^2 - 4 a c)) / (2 a)',
  ],
  [
    '|a| =\\begin{cases} a & a \\ge 0 \\\\ -a & a < 0 \\end{cases}',
    'abs(a) = cases(a & a >= 0, -a & a < 0)',
  ],
  [
    '\\left|\\frac{a}{b}\\right| = \\frac{|a|}{|b|}',
    'abs((a) / (b)) = abs(a) / abs(b)',
  ],
  [
    '\\left(\\frac{a}{b}\\right)\\left(\\frac{c}{d}\\right)=\\frac{ac}{bd}',
    '((a) / (b)) * ((c) / (d)) = (a c) / (b d)',
  ],
  [
    '\\left(\\frac{a}{b}\\right)\\div\\left(\\frac{c}{d}\\right)=\\left(\\frac{a}{b}\\right)\\left(\\frac{d}{c}\\right)=\\frac{ad}{bc}',
    '((a) / (b)) div ((c) / (d)) = ((a) / (b)) * ((d) / (c)) = (a d) / (b c)',
  ],
  ['A=P\\!\\left(1+\\frac{r}{n}\\right)^{nt}', 'A = P (1 + (r) / (n))^(n t)'],
  [
    '\\log_b\\!\\left(\\frac{x}{y}\\right)=\\log_b(x)-\\log_b(y)',
    'log_b((x) / (y)) = log_b(x) - log_b(y)',
  ],
  [
    '\\text{Rational Root Thm: } \\frac{p}{q}, \\; p\\mid a_0, \\; q\\mid a_n',
    '"Rational Root Thm:" (p) / (q), p | a_0, q | a_n',
  ],
  [
    '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}^{-1}=\\frac{1}{ad-bc}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}',
    'mat(a, b; c, d)^(-1) = (1) / (a d - b c) * mat(d, -b; -c, a)',
  ],
  [
    '\\det\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}=ad-bc',
    'det mat(a, b; c, d) = a d - b c',
  ],
  [
    '(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^{n-k}b^k',
    '(a + b)^n = sum_(k = 0)^n binom(n, k) a^(n - k) b^k',
  ],
  ['\\binom{n}{k}=\\frac{n!}{k!(n-k)!}', 'binom(n, k) = (n!) / (k! (n - k)!)'],
  [
    'n!=n(n-1)(n-2)\\cdots(2)(1) \\quad\\quad 0!=1',
    'n! = n(n - 1)(n - 2) ... (2)(1) ; 0! = 1',
  ],
  [
    'S_\\infty=\\frac{a_1}{1-r} \\quad |r|<1',
    'S_"∞" = (a_1) / (1-r) ; |r| < 1',
  ],
  [
    '\\text{Rotation } 90^\\circ \\text{ CCW: } (x,y)\\to(-y,x)',
    '"Rotation" 90 "deg" "CCW:" (x, y) -> (-y, x)',
  ],
  [
    '\\text{Rotation } 180^\\circ\\text{: } (x,y)\\to(-x,-y)',
    '"Rotation" 180 "deg:" (x, y) -> (-x, -y)',
  ],
  [
    '\\text{Rotation } 270^\\circ \\text{ CCW: } (x,y)\\to(y,-x)',
    '"Rotation" 270 "deg" "CCW:" (x, y) -> (y, -x)',
  ],
])

const keepWords = new Set([
  'abs',
  'binom',
  'cases',
  'det',
  'div',
  'dot',
  'infty',
  'ln',
  'log',
  'mat',
  'perp',
  'pi',
  'root',
  'sqrt',
  'sum',
  'theta',
  'times',
])

function stripOuterBraces(input: string) {
  if (!input.startsWith('{') || !input.endsWith('}')) {
    return input
  }

  let depth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0 && index < input.length - 1) {
      return input
    }
  }

  return input.slice(1, -1)
}

function readDelimited(
  input: string,
  start: number,
  open: string,
  close: string,
) {
  if (input[start] !== open) {
    return null
  }

  let depth = 0

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (char === '\\') {
      index += 1
      continue
    }

    if (char === open) depth += 1
    if (char === close) depth -= 1

    if (depth === 0) {
      return {
        value: input.slice(start + 1, index),
        end: index + 1,
      }
    }
  }

  return null
}

function replaceCommand(
  input: string,
  command: string,
  arity: number,
  mapper: (args: string[]) => string,
): string {
  let output = ''
  let cursor = 0

  while (cursor < input.length) {
    const index = input.indexOf(command, cursor)
    if (index === -1) {
      output += input.slice(cursor)
      break
    }

    output += input.slice(cursor, index)
    let end = index + command.length
    const args: string[] = []
    let failed = false

    for (let argIndex = 0; argIndex < arity; argIndex += 1) {
      while (input[end] === ' ') {
        end += 1
      }

      const group = readDelimited(input, end, '{', '}')
      if (!group) {
        failed = true
        break
      }

      args.push(group.value)
      end = group.end
    }

    if (failed) {
      output += command
      cursor = index + command.length
      continue
    }

    output += mapper(args)
    cursor = end
  }

  return output
}

function replaceSqrt(input: string) {
  let output = ''
  let cursor = 0

  while (cursor < input.length) {
    const index = input.indexOf('\\sqrt', cursor)
    if (index === -1) {
      output += input.slice(cursor)
      break
    }

    output += input.slice(cursor, index)
    let end = index + '\\sqrt'.length
    let degree: string | undefined

    if (input[end] === '[') {
      const bracket = readDelimited(input, end, '[', ']')
      if (bracket) {
        degree = bracket.value
        end = bracket.end
      }
    }

    const body = readDelimited(input, end, '{', '}')
    if (!body) {
      output += '\\sqrt'
      cursor = index + '\\sqrt'.length
      continue
    }

    output += degree
      ? `root(${convertLatexToTypst(degree)}, ${convertLatexToTypst(body.value)})`
      : `sqrt(${convertLatexToTypst(body.value)})`
    cursor = body.end
  }

  return output
}

function replaceMatrices(input: string) {
  return input.replace(
    /\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g,
    (_, body: string) => {
      const rows = body
        .split('\\\\')
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) =>
          row
            .split('&')
            .map((cell) => convertLatexToTypst(cell.trim()))
            .join(', '),
        )

      return `mat(${rows.join('; ')})`
    },
  )
}

function replaceTextSubscripts(input: string) {
  return input.replace(/_\{"([^"]+)"\}/g, '_"$1"')
}

function cleanup(input: string) {
  return input
    .replaceAll('\\left', '')
    .replaceAll('\\right', '')
    .replaceAll('\\!', '')
    .replaceAll('\\;', ' ')
    .replaceAll('\\quad', ' ; ')
    .replaceAll('\\qquad', ' ; ')
    .replaceAll('\\cdot', ' dot ')
    .replaceAll('\\times', ' times ')
    .replaceAll('\\div', ' div ')
    .replaceAll('\\iff', ' <=> ')
    .replaceAll('\\implies', ' => ')
    .replaceAll('\\to', ' -> ')
    .replaceAll('\\ge', ' >= ')
    .replaceAll('\\le', ' <= ')
    .replaceAll('\\mid', ' | ')
    .replaceAll('\\perp', ' perp ')
    .replaceAll('\\pi', ' pi ')
    .replaceAll('\\theta', ' theta ')
    .replaceAll('\\infty', ' infty ')
    .replaceAll('\\ln', ' ln ')
    .replaceAll('\\log', ' log ')
    .replaceAll('\\det', ' det ')
    .replaceAll('\\pm', ' plus.minus ')
    .replaceAll('\\cdots', ' ... ')
    .replaceAll('\\circ', ' "deg" ')
    .replaceAll('\\{', '{')
    .replaceAll('\\}', '}')
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/\[ /g, '[')
    .replace(/ \]/g, ']')
    .replace(/ \^ /g, '^')
    .replace(/ _ /g, '_')
    .replace(/\s*;\s*/g, ' ; ')
    .trim()
}

function splitUnknownWords(input: string) {
  return input
    .split('"')
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment
      }

      return segment.replace(/[A-Za-z]+/g, (word) => {
        if (keepWords.has(word)) {
          return word
        }

        return word.split('').join(' ')
      })
    })
    .join('"')
}

function convertLatexToTypst(input: string): string {
  const override = manualOverrides.get(input)
  if (override) {
    return override
  }

  let output = input
  output = replaceMatrices(output)
  output = replaceCommand(
    output,
    '\\text',
    1,
    ([value]) => `"${stripOuterBraces(value).replaceAll('\\\\', ' ').trim()}"`,
  )
  output = replaceSqrt(output)
  output = replaceCommand(
    output,
    '\\frac',
    2,
    ([left, right]) =>
      `(${convertLatexToTypst(left)}) / (${convertLatexToTypst(right)})`,
  )
  output = replaceCommand(
    output,
    '\\binom',
    2,
    ([left, right]) =>
      `binom(${convertLatexToTypst(left)}, ${convertLatexToTypst(right)})`,
  )
  output = cleanup(output)
  output = output.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'sum_($1)^$2')
  output = replaceTextSubscripts(output)
  output = output.replace(/\{([^{}]+)\}/g, (_, value: string) => value)
  output = splitUnknownWords(output)
  output = output.replace(/_\s+/g, '_')
  output = output.replace(/\s+/g, ' ').trim()
  return output
}

for (const relativePath of files) {
  const absolutePath = path.join(process.cwd(), relativePath)
  const raw = await readFile(absolutePath, 'utf8')
  const data = JSON.parse(raw) as FormulaClass

  const next = {
    ...data,
    categories: data.categories.map((category) => ({
      ...category,
      formulas: category.formulas.map(({ latex, typst, ...formula }) => ({
        ...formula,
        typst: latex
          ? convertLatexToTypst(latex)
          : splitUnknownWords(typst ?? ''),
      })),
    })),
  }

  await writeFile(absolutePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}
