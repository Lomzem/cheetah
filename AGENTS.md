- ALWAYS use `bun` instead of `npm` or `node`
- AVOID as much as you can using unicode symbols to represent math
  symbols! Instead, reference https://typst.app/docs/reference/symbols/sym/
- ALWAYS write math variables in _math mode_ rather than _plaintext_.
  E.g. use `In this equation, $x = 2$` rather than `In this equation,
x = 2`.
- To indicate multiplication in Typst in Math Mode with a dot, use
  `dot` rather than `*`. E.g. `$2 dot 2 = 4$` rather than `$2 * 2 = 4$`
- In formula data, quoted prose at the start of a Typst string does _not_
  automatically mean the whole formula should render as plaintext. Mixed
  prose+math entries like `"Dilation:" (x,y) arrow.r (k x,k y)` must stay in
  math mode so variables render as math.
- Pure prose / label-style formulas should use the wrapped text-block render
  path, but mixed prose+math formulas must stay in math mode. Be especially
  careful with transformations, theorem labels, and formulas that begin with a
  quoted phrase.
- Do not use visible separator hacks like `; ;` inside Typst formula strings to
  create spacing; they show up in the final PDF. Use Typst spacing/symbol
  constructs such as `space.quad` instead.
- When using Typst symbol names, prefer the actual names from
  https://typst.app/docs/reference/symbols/sym/ rather than approximations.
  Common gotchas from this repo: use `degree` instead of `deg`, `infinity`
  instead of Unicode infinity or `infty`, `arrow.r` / `arrow.r.double` /
  `arrow.l.r.double` instead of ASCII arrows, and `dot` for multiplication.
- If you change formula conversion rules in `scripts/convert-formulas-to-typst.ts`,
  also update any matching manual overrides and existing formula-data entries
  that were previously generated from those rules, then run `bun run verify:typst`.
