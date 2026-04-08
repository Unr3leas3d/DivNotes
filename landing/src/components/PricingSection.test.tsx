import { fireEvent, render, screen } from '@testing-library/react'
import { PricingSection } from './PricingSection'

describe('PricingSection', () => {
  it('defaults to yearly pricing and toggles to monthly', () => {
    render(<PricingSection />)

    expect(screen.getByText('$8.33')).toBeInTheDocument()
    expect(screen.getByText('Billed $100/year')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))

    expect(screen.getByText('$10')).toBeInTheDocument()
    expect(screen.queryByText('Billed $100/year')).not.toBeInTheDocument()
  })
})
