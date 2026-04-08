import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('hydrates from localStorage and toggles the document theme', async () => {
    localStorage.setItem('canopy-theme', 'dark')

    render(<ThemeToggle />)

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark')
    })
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))

    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass('dark')
    })
    expect(localStorage.getItem('canopy-theme')).toBe('light')
  })
})
