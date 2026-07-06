const GITHUB_URL = 'https://github.com/knokvik'

export function MadeByFooter() {
  return (
    <footer className="shrink-0 border-t border-desk-border/60 bg-desk-panel/40 px-4 py-1 text-center">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-desk-muted transition hover:text-desk-profit"
      >
        Made by <span className="font-semibold text-desk-info">knokvik</span>
      </a>
    </footer>
  )
}