import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalculationBreakdown } from '../components/formula-builder/CalculationBreakdown'
import { DEFAULT_TEST_CONTEXT } from '../utils/formulaTypes'

describe('CalculationBreakdown Component', () => {
  it('should not render for empty formula', () => {
    const { container } = render(
      <CalculationBreakdown formula="" context={DEFAULT_TEST_CONTEXT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render breakdown header', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    expect(screen.getByTestId('breakdown-header')).toBeInTheDocument()
    expect(screen.getByText('Calculation Breakdown')).toBeInTheDocument()
  })

  it('should show success icon for valid formula', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('should show warning icon for invalid formula', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × ×"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })

  it('should display result in header for valid formula', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    expect(screen.getByText(/Result: ₹47,500.00/)).toBeInTheDocument()
  })

  it('should expand when header is clicked', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByTestId('breakdown-content')).toBeInTheDocument()
  })

  it('should collapse when header is clicked again', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    
    // Expand
    fireEvent.click(header)
    expect(screen.getByTestId('breakdown-content')).toBeInTheDocument()
    
    // Collapse
    fireEvent.click(header)
    expect(screen.queryByTestId('breakdown-content')).not.toBeInTheDocument()
  })

  it('should display input values when expanded', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByText('Input Values')).toBeInTheDocument()
    expect(screen.getByText(/grossWeight:/)).toBeInTheDocument()
    expect(screen.getByText(/netWeight:/)).toBeInTheDocument()
    expect(screen.getByText(/metalRate:/)).toBeInTheDocument()
  })

  it('should display calculation steps when expanded', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByText('Step-by-Step Calculation')).toBeInTheDocument()
    expect(screen.getByTestId('step-0')).toBeInTheDocument()
    expect(screen.getByText(/Original:/)).toBeInTheDocument()
  })

  it('should display errors for invalid formula', () => {
    render(
      <CalculationBreakdown
        formula="unknownVar × metalRate"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByText('Errors')).toBeInTheDocument()
    expect(screen.getByText(/Unknown variable/)).toBeInTheDocument()
  })

  it('should display warnings when present', () => {
    render(
      <CalculationBreakdown
        formula="netWeight − grossWeight"
        context={DEFAULT_TEST_CONTEXT}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByText('Warnings')).toBeInTheDocument()
  })

  it('should format context values correctly', () => {
    render(
      <CalculationBreakdown
        formula="netWeight × metalRate"
        context={{ ...DEFAULT_TEST_CONTEXT, metalRate: 5234.56 }}
      />
    )
    
    const header = screen.getByTestId('breakdown-header')
    fireEvent.click(header)
    
    expect(screen.getByText(/5,234.56/)).toBeInTheDocument()
  })
})
