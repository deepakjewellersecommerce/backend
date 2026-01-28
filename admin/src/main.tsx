import React from 'react'
import { createRoot } from 'react-dom/client'
import { FormulaBuilder } from './components/formula-builder'
import { DEFAULT_TEST_CONTEXT } from './utils/formulaTypes'

/**
 * Demo application showcasing the Formula Builder component
 */
function App() {
  const [chips, setChips] = React.useState<string[]>([])

  return (
    <div style={{ 
      maxWidth: '1000px', 
      margin: '40px auto', 
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      <header style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: '#1a237e' }}>
          Formula Builder Demo
        </h1>
        <p style={{ fontSize: '16px', color: '#666' }}>
          Interactive chip-based formula builder for jewelry pricing
        </p>
      </header>

      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '16px', 
        borderRadius: '8px',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Test Context Values:
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '8px',
          fontSize: '13px',
        }}>
          {Object.entries(DEFAULT_TEST_CONTEXT).map(([key, value]) => (
            <div key={key} style={{ 
              backgroundColor: '#fff', 
              padding: '8px', 
              borderRadius: '4px',
            }}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <FormulaBuilder
          value={chips}
          onChange={setChips}
          context={DEFAULT_TEST_CONTEXT}
          showTemplates={true}
          showBreakdown={true}
        />
      </div>

      <div style={{
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#1565c0' }}>
          Formula Output:
        </h3>
        <div style={{
          backgroundColor: '#fff',
          padding: '12px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          <strong>formula:</strong> "{chips.join(' ')}"
        </div>
        <div style={{
          backgroundColor: '#fff',
          padding: '12px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}>
          <strong>formulaChips:</strong> {JSON.stringify(chips)}
        </div>
      </div>

      <footer style={{ 
        marginTop: '48px', 
        paddingTop: '24px', 
        borderTop: '1px solid #e0e0e0',
        textAlign: 'center',
        color: '#999',
        fontSize: '13px',
      }}>
        <p>Formula Builder Component v1.0.0</p>
        <p style={{ marginTop: '8px' }}>
          Built with React, TypeScript, and Vite
        </p>
      </footer>
    </div>
  )
}

// Mount the app
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}
