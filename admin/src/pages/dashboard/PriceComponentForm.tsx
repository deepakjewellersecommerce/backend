import React from 'react'
import { FormulaBuilder } from '../../components/formula-builder'
import { DEFAULT_TEST_CONTEXT } from '../../utils/formulaTypes'
import { chipsToFormula } from '../../utils/formulaValidator'

/**
 * Example: Price component form integration
 */
export const PriceComponentForm: React.FC = () => {
  const [formulaChips, setFormulaChips] = React.useState<string[]>([])
  const [componentData, setComponentData] = React.useState({
    name: '',
    key: '',
    description: '',
    calculationType: 'FORMULA',
    isSystemComponent: false,
    isActive: true,
    isVisible: true,
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setComponentData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const formData = {
      ...componentData,
      formula: chipsToFormula(formulaChips),
      formulaChips,
    }
    
    console.log('Submitting price component:', formData)
    // Here you would send to backend API
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Price Component Configuration</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Component Name *
            </label>
            <input
              type="text"
              value={componentData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Making Charges"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Component Key *
            </label>
            <input
              type="text"
              value={componentData.key}
              onChange={(e) => handleInputChange('key', e.target.value.toLowerCase())}
              placeholder="e.g., making_charges"
              required
              pattern="[a-z][a-z0-9_]*"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Lowercase letters, numbers, and underscores only
            </small>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Description
          </label>
          <textarea
            value={componentData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe this price component..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Calculation Type *
          </label>
          <select
            value={componentData.calculationType}
            onChange={(e) => handleInputChange('calculationType', e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="FIXED">Fixed Amount (₹)</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="PER_GRAM">Per Gram (₹/g)</option>
            <option value="FORMULA">Custom Formula</option>
          </select>
        </div>

        {componentData.calculationType === 'FORMULA' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Formula Builder
            </label>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
              Build a custom pricing formula using variables, operators, and numbers.
              Use quick-start templates for common scenarios.
            </p>
            <FormulaBuilder
              value={formulaChips}
              onChange={setFormulaChips}
              context={DEFAULT_TEST_CONTEXT}
              showTemplates={true}
              showBreakdown={true}
            />
          </div>
        )}

        <div style={{ marginBottom: '20px', display: 'flex', gap: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={componentData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
            />
            <span style={{ fontSize: '14px' }}>Active (included in calculations)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={componentData.isVisible}
              onChange={(e) => handleInputChange('isVisible', e.target.checked)}
            />
            <span style={{ fontSize: '14px' }}>Visible (shown to customers)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={componentData.isSystemComponent}
              onChange={(e) => handleInputChange('isSystemComponent', e.target.checked)}
            />
            <span style={{ fontSize: '14px' }}>System Component</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              backgroundColor: '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save Component
          </button>
          <button
            type="button"
            onClick={() => {
              setFormulaChips([])
              setComponentData({
                name: '',
                key: '',
                description: '',
                calculationType: 'FORMULA',
                isSystemComponent: false,
                isActive: true,
                isVisible: true,
              })
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#fff',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Reset Form
          </button>
        </div>
      </form>
    </div>
  )
}
