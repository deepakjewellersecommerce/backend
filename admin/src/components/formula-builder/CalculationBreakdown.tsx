import React from 'react'
import { FormulaContext } from '../../utils/formulaTypes'
import { validateFormula, formatNumber } from '../../utils/formulaValidator'

export interface CalculationBreakdownProps {
  formula: string
  context: FormulaContext
  'data-testid'?: string
}

/**
 * Accordion component showing step-by-step formula evaluation
 */
export const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({
  formula,
  context,
  'data-testid': testId,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  if (!formula || formula.trim() === '') {
    return null
  }

  const validation = validateFormula(formula, context)

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginTop: '16px',
        overflow: 'hidden',
      }}
      data-testid={testId}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '12px 16px',
          backgroundColor: validation.isValid ? '#f1f8f4' : '#fef1f1',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none',
        }}
        data-testid="breakdown-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>
            {validation.isValid ? '✓' : '⚠️'}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>
              Calculation Breakdown
            </div>
            {validation.isValid && validation.result !== undefined && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                Result: ₹{formatNumber(validation.result)}
              </div>
            )}
          </div>
        </div>
        <span
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '12px',
          }}
        >
          ▼
        </span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '16px' }} data-testid="breakdown-content">
          {/* Context values */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#666' }}>
              Input Values
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '8px',
              }}
            >
              {Object.entries(context).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{key}:</span>{' '}
                  <span>{typeof value === 'number' ? formatNumber(value) : value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation steps */}
          {validation.steps && validation.steps.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#666' }}>
                Step-by-Step Calculation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {validation.steps.map((step, index) => {
                  const [label, value] = step.split(': ')
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: index === validation.steps!.length - 1 ? '#e8f5e9' : '#f5f5f5',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                      data-testid={`step-${index}`}
                    >
                      <span style={{ color: '#666', fontWeight: 600 }}>{label}:</span>{' '}
                      <span>{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#d32f2f' }}>
                Errors
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {validation.errors.map((error, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#ffebee',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#d32f2f',
                    }}
                  >
                    ⚠️ {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#f57c00' }}>
                Warnings
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {validation.warnings.map((warning, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fff3e0',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#f57c00',
                    }}
                  >
                    ⚡ {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
