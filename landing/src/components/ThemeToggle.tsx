import { useEffect, useState } from 'react'
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = localStorage.getItem('canopy-theme')
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('canopy-theme', theme)
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground transition-colors hover:bg-secondary"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <HugeiconsIcon
        icon={theme === 'light' ? Sun03Icon : Moon02Icon}
        color="currentColor"
        strokeWidth={1.8}
        size={18}
      />
    </button>
  )
}
