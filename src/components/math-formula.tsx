import katex from 'katex'

type MathFormulaProps = {
  latex: string
}

export function MathFormula({ latex }: MathFormulaProps) {
  try {
    const html = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: true,
      output: 'html',
      strict: 'warn',
    })

    return <div dangerouslySetInnerHTML={{ __html: html }} />
  } catch {
    return <code className="text-xs text-stone-600">{latex}</code>
  }
}
