import React from 'react'
import { FormulaBuilder } from '../../components/formula-builder'
import { DEFAULT_TEST_CONTEXT } from '../../utils/formulaTypes'
import { chipsToFormula } from '../../utils/formulaValidator'

/**
 * Example: Subcategory pricing form integration
 */
export const SubcategoryPricingForm: React.FC = () => {
  const [formulaChips, setFormulaChips] = React.useState<string[]>([])
  const [componentName, setComponentName] = React.useState('')
  const [calculationType, setCalculationType] = React.useState('FORMULA')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const formData = {
      componentName,
      calculationType,
      formula: chipsToFormula(formulaChips),
      formulaChips,
    }
    
    console.log('Submitting subcategory pricing:', formData)
    // Here you would send to backend API
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Subcategory Pricing Configuration</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="componentName"
            style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}
          >
            Component Name
          </label>
          <input
            id="componentName"
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="e.g., Making Charges, Wastage"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="calculationType"
            style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}
          >
            Calculation Type
          </label>
          <select
            id="calculationType"
            value={calculationType}
            onChange={(e) => setCalculationType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="FIXED">Fixed Amount</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="PER_GRAM">Per Gram</option>
            <option value="FORMULA">Custom Formula</option>
          </select>
        </div>

        {calculationType === 'FORMULA' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Formula Builder
            </label>
            <FormulaBuilder
              value={formulaChips}
              onChange={setFormulaChips}
              context={DEFAULT_TEST_CONTEXT}
              showTemplates={true}
              showBreakdown={true}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
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
            Save Configuration
          </button>
          <button
            type="button"
            onClick={() => {
              setFormulaChips([])
              setComponentName('')
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
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}
