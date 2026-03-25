import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_24px_80px_-48px_rgba(120,53,15,0.45)] backdrop-blur">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
          About
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Build a printable math sheet without touching LaTeX.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
          This prototype organizes formulas as JSON, stores draft selections in
          TanStack DB local storage, renders a locked LaTeX template, and uses a
          Tectonic-compatible compiler path for preview and export.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            'Formula Library',
            'Class-by-class JSON files with stable IDs and source-order rendering.',
          ],
          [
            'Beginner-Friendly Builder',
            'Tap formulas, choose columns, add notes, and download `.tex` or `.pdf`.',
          ],
          [
            'Safe Compilation',
            'The preview path only compiles generated templates, never arbitrary raw user LaTeX.',
          ],
        ].map(([title, body]) => (
          <article
            key={title}
            className="rounded-[1.5rem] border border-stone-200 bg-white/80 p-6 shadow-sm"
          >
            <h2 className="font-serif text-2xl font-semibold text-stone-900">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">{body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
