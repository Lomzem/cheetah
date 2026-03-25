import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/75 px-4 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight text-stone-900">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm text-stone-900 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 font-serif text-sm font-bold text-orange-50">
              C
            </span>
            Cheetah Cheat Sheets
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-4 text-sm font-medium text-stone-600 sm:order-2 sm:ml-auto sm:w-auto">
          <Link
            to="/"
            className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-stone-900"
            activeProps={{
              className:
                'rounded-full bg-orange-600 px-3 py-1.5 text-orange-50',
            }}
          >
            Builder
          </Link>
          <Link
            to="/about"
            className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-stone-900"
            activeProps={{
              className:
                'rounded-full bg-orange-600 px-3 py-1.5 text-orange-50',
            }}
          >
            About
          </Link>
          <a
            href="https://tanstack.com/start/latest/docs/framework/react/overview"
            className="rounded-full px-3 py-1.5 transition hover:bg-orange-100 hover:text-stone-900"
            target="_blank"
            rel="noreferrer"
          >
            TanStack Start
          </a>
        </div>
      </nav>
    </header>
  )
}
