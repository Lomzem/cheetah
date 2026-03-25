import { BlockMath } from 'react-katex'

type MathFormulaProps = {
  latex: string
}

export function MathFormula({ latex }: MathFormulaProps) {
  try {
    return <BlockMath math={latex} />
  } catch {
    return <code className="text-xs text-stone-600">{latex}</code>
  }
}
