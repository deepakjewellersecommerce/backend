import React from 'react'
import { FormulaChip } from './FormulaChip'
import { FORMULA_VARIABLES, OPERATORS } from '../../utils/formulaTypes'
import { validateFormula, chipsToFormula } from '../../utils/formulaValidator'

export interface FormulaInputProps {
  chips: string[]
  onChange: (chips: string[]) => void
  placeholder?: string
  disabled?: boolean
  showValidation?: boolean
  'data-testid'?: string
}

/**
 * Chip-based formula input field
 */
export const FormulaInput: React.FC<FormulaInputProps> = ({
  chips,
  onChange,
  placeholder = 'Click to add variables and operators...',
  disabled = false,
  showValidation = true,
  'data-testid': testId,
}) => {
  const [showPicker, setShowPicker] = React.useState(false)
  const [numberInput, setNumberInput] = React.useState('')
  const [showNumberInput, setShowNumberInput] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const formula = chipsToFormula(chips)
  const validation = validateFormula(formula)

  const getChipType = (value: string): 'variable' | 'operator' | 'number' | 'function' => {
    if (value in FORMULA_VARIABLES) return 'variable'
    if (Object.values(OPERATORS).some(op => op.display === value || op.symbol === value)) return 'operator'
    if (!isNaN(parseFloat(value))) return 'number'
    return 'function'
  }

  const handleAddChip = (value: string) => {
    onChange([...chips, value])
  }

  const handleRemoveChip = (index: number) => {
    const newChips = chips.filter((_, i) => i !== index)
    onChange(newChips)
  }

  const handleAddNumber = () => {
    if (numberInput && !isNaN(parseFloat(numberInput))) {
      handleAddChip(numberInput)
      setNumberInput('')
      setShowNumberInput(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddNumber()
    }
  }

  // Close picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
        setShowNumberInput(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }} data-testid={testId}>
      {/* Main input area */}
      <div
        style={{
          minHeight: '60px',
          padding: '8px',
          border: '2px solid ' + (validation.isValid || chips.length === 0 ? '#ddd' : '#d32f2f'),
          borderRadius: '8px',
          backgroundColor: disabled ? '#f5f5f5' : '#fff',
          cursor: disabled ? 'not-allowed' : 'text',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px',
        }}
        onClick={() => !disabled && setShowPicker(true)}
        data-testid="formula-input-area"
      >
        {chips.length === 0 ? (
          <span style={{ color: '#999', padding: '8px' }}>{placeholder}</span>
        ) : (
          chips.map((chip, index) => (
            <FormulaChip
              key={`${chip}-${index}`}
              value={chip}
              type={getChipType(chip)}
              onDelete={() => handleRemoveChip(index)}
              data-testid={`chip-${index}`}
            />
          ))
        )}
      </div>

      {/* Validation feedback */}
      {showValidation && chips.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px' }}>
          {!validation.isValid && (
            <div style={{ color: '#d32f2f' }} data-testid="validation-errors">
              {validation.errors.map((error, i) => (
                <div key={i}>⚠️ {error}</div>
              ))}
            </div>
          )}
          {validation.isValid && validation.warnings.length > 0 && (
            <div style={{ color: '#f57c00' }} data-testid="validation-warnings">
              {validation.warnings.map((warning, i) => (
                <div key={i}>⚡ {warning}</div>
              ))}
            </div>
          )}
          {validation.isValid && validation.result !== undefined && (
            <div style={{ color: '#2e7d32' }} data-testid="validation-result">
              ✓ Test result: {validation.result.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Picker panel */}
      {showPicker && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            padding: '16px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
          data-testid="formula-picker"
        >
          {/* Variables */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Variables</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(FORMULA_VARIABLES).map(([key, { display }]) => (
                <button
                  key={key}
                  onClick={() => handleAddChip(key)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #90caf9',
                    borderRadius: '16px',
                    backgroundColor: '#e3f2fd',
                    color: '#1565c0',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  data-testid={`add-variable-${key}`}
                >
                  {display}
                </button>
              ))}
            </div>
          </div>

          {/* Operators */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Operators</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(OPERATORS).map(([key, { display }]) => (
                <button
                  key={key}
                  onClick={() => handleAddChip(display)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ffb74d',
                    borderRadius: '16px',
                    backgroundColor: '#fff3e0',
                    color: '#e65100',
                    cursor: 'pointer',
                    fontSize: '13px',
                    minWidth: '40px',
                  }}
                  data-testid={`add-operator-${key}`}
                >
                  {display}
                </button>
              ))}
            </div>
          </div>

          {/* Number input */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Number</h4>
            {!showNumberInput ? (
              <button
                onClick={() => setShowNumberInput(true)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ce93d8',
                  borderRadius: '16px',
                  backgroundColor: '#f3e5f5',
                  color: '#6a1b9a',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                data-testid="show-number-input"
              >
                + Add Number
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter number..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ce93d8',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                  data-testid="number-input"
                />
                <button
                  onClick={handleAddNumber}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#6a1b9a',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  data-testid="add-number-button"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
