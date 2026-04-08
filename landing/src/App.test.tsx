import { cleanup, render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  afterEach(() => {
    window.location.hash = ''
    cleanup()
  })

  it('renders the redesigned landing page sections', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Think on top of the web.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Everything you need to annotate the web.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Simple, transparent pricing.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }),
    ).toHaveAttribute('href', '#/privacy')
    expect(screen.getAllByText('Canopy')).toHaveLength(2)
  })

  it('renders the privacy policy for the privacy hash route', () => {
    window.location.hash = '#/privacy'

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Privacy Policy' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Think on top of the web.' }),
    ).not.toBeInTheDocument()
  })
})
