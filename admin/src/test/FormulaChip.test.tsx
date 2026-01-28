import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormulaChip } from '../components/formula-builder/FormulaChip'

describe('FormulaChip Component', () => {
  it('should render a variable chip', () => {
    render(<FormulaChip value="netWeight" type="variable" />)
    expect(screen.getByText('netWeight')).toBeInTheDocument()
  })

  it('should render an operator chip', () => {
    render(<FormulaChip value="×" type="operator" />)
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('should render a number chip', () => {
    render(<FormulaChip value="100" type="number" />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should call onDelete when clicked', () => {
    const handleDelete = vi.fn()
    render(<FormulaChip value="test" type="variable" onDelete={handleDelete} />)
    
    const chip = screen.getByRole('button')
    fireEvent.click(chip)
    
    expect(handleDelete).toHaveBeenCalledTimes(1)
  })

  it('should show delete icon on hover when onDelete is provided', () => {
    const handleDelete = vi.fn()
    render(<FormulaChip value="test" type="variable" onDelete={handleDelete} />)
    
    const chip = screen.getByRole('button')
    fireEvent.mouseEnter(chip)
    
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  it('should not show delete icon when onDelete is not provided', () => {
    render(<FormulaChip value="test" type="variable" />)
    
    const chip = screen.getByTestId('formula-chip-variable')
    fireEvent.mouseEnter(chip)
    
    expect(screen.queryByText('✕')).not.toBeInTheDocument()
  })

  it('should call onHover when mouse enters and leaves', () => {
    const handleHover = vi.fn()
    render(<FormulaChip value="test" type="variable" onHover={handleHover} />)
    
    const chip = screen.getByTestId('formula-chip-variable')
    
    fireEvent.mouseEnter(chip)
    expect(handleHover).toHaveBeenCalledWith(true)
    
    fireEvent.mouseLeave(chip)
    expect(handleHover).toHaveBeenCalledWith(false)
  })

  it('should have correct styling for variable type', () => {
    render(<FormulaChip value="test" type="variable" data-testid="test-chip" />)
    const chip = screen.getByTestId('test-chip')
    
    const style = window.getComputedStyle(chip)
    expect(style.backgroundColor).toBeTruthy()
  })

  it('should have correct accessibility attributes', () => {
    render(<FormulaChip value="netWeight" type="variable" onDelete={vi.fn()} />)
    const chip = screen.getByRole('button')
    
    expect(chip).toHaveAttribute('aria-label', 'variable chip: netWeight')
    expect(chip).toHaveAttribute('tabIndex', '0')
  })
})
