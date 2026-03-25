export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-stone-200 px-4 pb-12 pt-8 text-stone-600">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
        <p className="m-0">&copy; {year} Cheetah Cheat Sheets.</p>
        <p className="m-0 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-stone-500">
          JSON formulas + TanStack Start + Tectonic
        </p>
      </div>
    </footer>
  )
}
