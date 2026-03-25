import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 px-4 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-[1600px] items-center gap-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-foreground no-underline transition-opacity hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
            C
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Cheetah
          </span>
        </Link>

        <div className="flex items-center gap-1 text-sm font-medium">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            activeProps={{
              className: 'active',
            }}
          >
            Builder
          </Link>
          <Link
            to="/about"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            activeProps={{
              className: 'active',
            }}
          >
            About
          </Link>
        </div>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
