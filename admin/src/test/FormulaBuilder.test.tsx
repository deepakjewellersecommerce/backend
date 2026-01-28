import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormulaBuilder } from '../components/formula-builder/FormulaBuilder'
import { DEFAULT_TEST_CONTEXT } from '../utils/formulaTypes'

describe('FormulaBuilder Component', () => {
  it('should render formula input', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} />)
    expect(screen.getByTestId('formula-input')).toBeInTheDocument()
  })

  it('should render quick-start templates button', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={true} />)
    expect(screen.getByTestId('toggle-templates')).toBeInTheDocument()
  })

  it('should toggle template panel when button is clicked', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    
    // Show templates
    fireEvent.click(toggleButton)
    expect(screen.getByTestId('template-panel')).toBeInTheDocument()
    
    // Hide templates
    fireEvent.click(toggleButton)
    expect(screen.queryByTestId('template-panel')).not.toBeInTheDocument()
  })

  it('should display category filters in template panel', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    fireEvent.click(toggleButton)
    
    expect(screen.getByTestId('category-all')).toBeInTheDocument()
    expect(screen.getByTestId('category-basic')).toBeInTheDocument()
    expect(screen.getByTestId('category-wastage')).toBeInTheDocument()
    expect(screen.getByTestId('category-making')).toBeInTheDocument()
    expect(screen.getByTestId('category-advanced')).toBeInTheDocument()
  })

  it('should filter templates by category', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    fireEvent.click(toggleButton)
    
    // Click wastage category
    const wastageButton = screen.getByTestId('category-wastage')
    fireEvent.click(wastageButton)
    
    // Should show wastage templates
    expect(screen.getByText('Wastage Charges')).toBeInTheDocument()
  })

  it('should apply template when clicked', () => {
    const handleChange = vi.fn()
    render(<FormulaBuilder value={[]} onChange={handleChange} showTemplates={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    fireEvent.click(toggleButton)
    
    // Click first template
    const template = screen.getByTestId('template-0')
    fireEvent.click(template)
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('should show clear button when formula has chips', () => {
    render(<FormulaBuilder value={['netWeight', '×', 'metalRate']} onChange={vi.fn()} />)
    expect(screen.getByTestId('clear-formula')).toBeInTheDocument()
  })

  it('should not show clear button when formula is empty', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} />)
    expect(screen.queryByTestId('clear-formula')).not.toBeInTheDocument()
  })

  it('should clear formula when clear button is clicked', () => {
    const handleChange = vi.fn()
    render(
      <FormulaBuilder
        value={['netWeight', '×', 'metalRate']}
        onChange={handleChange}
      />
    )
    
    const clearButton = screen.getByTestId('clear-formula')
    fireEvent.click(clearButton)
    
    expect(handleChange).toHaveBeenCalledWith([])
  })

  it('should show calculation breakdown when showBreakdown is true', () => {
    render(
      <FormulaBuilder
        value={['netWeight', '×', 'metalRate']}
        onChange={vi.fn()}
        showBreakdown={true}
      />
    )
    
    expect(screen.getByTestId('calculation-breakdown')).toBeInTheDocument()
  })

  it('should not show calculation breakdown when showBreakdown is false', () => {
    render(
      <FormulaBuilder
        value={['netWeight', '×', 'metalRate']}
        onChange={vi.fn()}
        showBreakdown={false}
      />
    )
    
    expect(screen.queryByTestId('calculation-breakdown')).not.toBeInTheDocument()
  })

  it('should pass context to calculation breakdown', () => {
    const customContext = {
      ...DEFAULT_TEST_CONTEXT,
      metalRate: 6000,
    }
    
    render(
      <FormulaBuilder
        value={['netWeight', '×', 'metalRate']}
        onChange={vi.fn()}
        context={customContext}
        showBreakdown={true}
      />
    )
    
    const breakdown = screen.getByTestId('calculation-breakdown')
    expect(breakdown).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} disabled={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    expect(toggleButton).toBeDisabled()
  })

  it('should hide templates when showTemplates is false', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={false} />)
    
    expect(screen.queryByTestId('toggle-templates')).not.toBeInTheDocument()
  })

  it('should close template panel after selecting a template', () => {
    render(<FormulaBuilder value={[]} onChange={vi.fn()} showTemplates={true} />)
    
    const toggleButton = screen.getByTestId('toggle-templates')
    fireEvent.click(toggleButton)
    
    expect(screen.getByTestId('template-panel')).toBeInTheDocument()
    
    const template = screen.getByTestId('template-0')
    fireEvent.click(template)
    
    expect(screen.queryByTestId('template-panel')).not.toBeInTheDocument()
  })
})
