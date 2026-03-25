type MathFormulaProps = {
  typst: string
}

export function MathFormula({ typst }: MathFormulaProps) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
      {typst}
    </pre>
  )
}
