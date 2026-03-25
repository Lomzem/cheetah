export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border px-4 py-6">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between text-xs text-muted-foreground">
        <p className="m-0">&copy; {year} Cheetah Cheat Sheets</p>
        <p className="m-0 font-medium uppercase tracking-widest">
          TanStack + Tectonic
        </p>
      </div>
    </footer>
  )
}
