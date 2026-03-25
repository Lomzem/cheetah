import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Shield, Wrench } from 'lucide-react'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 lg:px-6">
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          About
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Build a printable math sheet without touching LaTeX.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          This prototype organizes formulas as JSON, stores draft selections in
          TanStack DB local storage, renders a locked LaTeX template, and uses a
          Tectonic-compatible compiler path for preview and export.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(
          [
            [
              BookOpen,
              'Formula Library',
              'Class-by-class JSON files with stable IDs and source-order rendering.',
            ],
            [
              Wrench,
              'Beginner-Friendly',
              'Tap formulas, choose columns, add notes, and download .tex or .pdf.',
            ],
            [
              Shield,
              'Safe Compilation',
              'The preview path only compiles generated templates, never arbitrary raw user LaTeX.',
            ],
          ] as const
        ).map(([Icon, title, body]) => (
          <article
            key={title}
            className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
          >
            <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="font-display text-base font-bold text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </article>
        ))}
      </section>
    </main>
  )
}
