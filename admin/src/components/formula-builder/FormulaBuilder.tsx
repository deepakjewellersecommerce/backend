import React from 'react'
import { FormulaInput } from './FormulaInput'
import { CalculationBreakdown } from './CalculationBreakdown'
import { FORMULA_TEMPLATES, FormulaTemplate, FormulaContext, DEFAULT_TEST_CONTEXT } from '../../utils/formulaTypes'
import { chipsToFormula, formulaToChips } from '../../utils/formulaValidator'

export interface FormulaBuilderProps {
  value: string[] // Array of chip values
  onChange: (chips: string[]) => void
  context?: FormulaContext
  showTemplates?: boolean
  showBreakdown?: boolean
  disabled?: boolean
  'data-testid'?: string
}

/**
 * Main Formula Builder component with templates and validation
 */
export const FormulaBuilder: React.FC<FormulaBuilderProps> = ({
  value,
  onChange,
  context = DEFAULT_TEST_CONTEXT,
  showTemplates = true,
  showBreakdown = true,
  disabled = false,
  'data-testid': testId,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all')
  const [showTemplatePanel, setShowTemplatePanel] = React.useState(false)

  const formula = chipsToFormula(value)

  const categories = ['all', 'basic', 'wastage', 'making', 'advanced']
  
  const filteredTemplates = selectedCategory === 'all'
    ? FORMULA_TEMPLATES
    : FORMULA_TEMPLATES.filter(t => t.category === selectedCategory)

  const handleTemplateSelect = (template: FormulaTemplate) => {
    onChange(formulaToChips(template.formula))
    setShowTemplatePanel(false)
  }

  const handleClear = () => {
    onChange([])
  }

  return (
    <div style={{ width: '100%' }} data-testid={testId}>
      {/* Quick-start templates button */}
      {showTemplates && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            disabled={disabled}
            style={{
              padding: '8px 16px',
              border: '1px solid #2196f3',
              borderRadius: '4px',
              backgroundColor: showTemplatePanel ? '#2196f3' : '#fff',
              color: showTemplatePanel ? '#fff' : '#2196f3',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
            }}
            data-testid="toggle-templates"
          >
            {showTemplatePanel ? '✕ Close Templates' : '📋 Quick-Start Templates'}
          </button>
          {value.length > 0 && (
            <button
              onClick={handleClear}
              disabled={disabled}
              style={{
                padding: '8px 16px',
                border: '1px solid #d32f2f',
                borderRadius: '4px',
                backgroundColor: '#fff',
                color: '#d32f2f',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '13px',
              }}
              data-testid="clear-formula"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Template panel */}
      {showTemplates && showTemplatePanel && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#fafafa',
          }}
          data-testid="template-panel"
        >
          {/* Category filters */}
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '16px',
                  backgroundColor: selectedCategory === category ? '#2196f3' : '#e0e0e0',
                  color: selectedCategory === category ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'capitalize',
                }}
                data-testid={`category-${category}`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Template list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTemplates.map((template, index) => (
              <div
                key={index}
                onClick={() => handleTemplateSelect(template)}
                style={{
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2196f3'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                data-testid={`template-${index}`}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  {template.description}
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#1565c0',
                    backgroundColor: '#e3f2fd',
                    padding: '6px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {template.formula}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula input */}
      <FormulaInput
        chips={value}
        onChange={onChange}
        disabled={disabled}
        showValidation={true}
        data-testid="formula-input"
      />

      {/* Calculation breakdown */}
      {showBreakdown && formula && (
        <CalculationBreakdown
          formula={formula}
          context={context}
          data-testid="calculation-breakdown"
        />
      )}
    </div>
  )
}
