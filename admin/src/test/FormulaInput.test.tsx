import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormulaInput } from '../components/formula-builder/FormulaInput'

describe('FormulaInput Component', () => {
  it('should render with placeholder when empty', () => {
    render(<FormulaInput chips={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Click to add variables and operators...')).toBeInTheDocument()
  })

  it('should render existing chips', () => {
    render(<FormulaInput chips={['netWeight', '×', 'metalRate']} onChange={vi.fn()} />)
    expect(screen.getByText('netWeight')).toBeInTheDocument()
    expect(screen.getByText('×')).toBeInTheDocument()
    expect(screen.getByText('metalRate')).toBeInTheDocument()
  })

  it('should show picker when clicked', () => {
    render(<FormulaInput chips={[]} onChange={vi.fn()} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    expect(screen.getByTestId('formula-picker')).toBeInTheDocument()
  })

  it('should add variable chip when variable button is clicked', () => {
    const handleChange = vi.fn()
    render(<FormulaInput chips={[]} onChange={handleChange} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    const netWeightButton = screen.getByTestId('add-variable-netWeight')
    fireEvent.click(netWeightButton)
    
    expect(handleChange).toHaveBeenCalledWith(['netWeight'])
  })

  it('should add operator chip when operator button is clicked', () => {
    const handleChange = vi.fn()
    render(<FormulaInput chips={[]} onChange={handleChange} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    const multiplyButton = screen.getByTestId('add-operator-multiply')
    fireEvent.click(multiplyButton)
    
    expect(handleChange).toHaveBeenCalledWith(['×'])
  })

  it('should show number input when add number button is clicked', () => {
    render(<FormulaInput chips={[]} onChange={vi.fn()} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    const showNumberButton = screen.getByTestId('show-number-input')
    fireEvent.click(showNumberButton)
    
    expect(screen.getByTestId('number-input')).toBeInTheDocument()
  })

  it('should add number chip when number is entered', () => {
    const handleChange = vi.fn()
    render(<FormulaInput chips={[]} onChange={handleChange} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    const showNumberButton = screen.getByTestId('show-number-input')
    fireEvent.click(showNumberButton)
    
    const numberInput = screen.getByTestId('number-input')
    fireEvent.change(numberInput, { target: { value: '100' } })
    
    const addButton = screen.getByTestId('add-number-button')
    fireEvent.click(addButton)
    
    expect(handleChange).toHaveBeenCalledWith(['100'])
  })

  it('should remove chip when chip is clicked', () => {
    const handleChange = vi.fn()
    render(<FormulaInput chips={['netWeight', '×', 'metalRate']} onChange={handleChange} />)
    
    const firstChip = screen.getByTestId('chip-0')
    fireEvent.click(firstChip)
    
    expect(handleChange).toHaveBeenCalledWith(['×', 'metalRate'])
  })

  it('should show validation errors for invalid formula', () => {
    render(
      <FormulaInput
        chips={['netWeight', '×', '×', 'metalRate']}
        onChange={vi.fn()}
        showValidation={true}
      />
    )
    
    expect(screen.getByTestId('validation-errors')).toBeInTheDocument()
  })

  it('should show validation result for valid formula', () => {
    render(
      <FormulaInput
        chips={['netWeight', '×', 'metalRate']}
        onChange={vi.fn()}
        showValidation={true}
      />
    )
    
    expect(screen.getByTestId('validation-result')).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<FormulaInput chips={[]} onChange={vi.fn()} disabled={true} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    expect(screen.queryByTestId('formula-picker')).not.toBeInTheDocument()
  })

  it('should use custom placeholder', () => {
    render(
      <FormulaInput
        chips={[]}
        onChange={vi.fn()}
        placeholder="Custom placeholder"
      />
    )
    
    expect(screen.getByText('Custom placeholder')).toBeInTheDocument()
  })

  it('should add number when Enter key is pressed', () => {
    const handleChange = vi.fn()
    render(<FormulaInput chips={[]} onChange={handleChange} />)
    
    const inputArea = screen.getByTestId('formula-input-area')
    fireEvent.click(inputArea)
    
    const showNumberButton = screen.getByTestId('show-number-input')
    fireEvent.click(showNumberButton)
    
    const numberInput = screen.getByTestId('number-input')
    fireEvent.change(numberInput, { target: { value: '42' } })
    fireEvent.keyPress(numberInput, { key: 'Enter', code: 'Enter', charCode: 13 })
    
    expect(handleChange).toHaveBeenCalledWith(['42'])
  })
})
