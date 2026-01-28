// Formula chip types
export type ChipType = 'variable' | 'operator' | 'number' | 'function'

export interface FormulaChip {
  id: string
  type: ChipType
  value: string
  display: string
}

// Available variables for formula building
export const FORMULA_VARIABLES = {
  grossWeight: { display: 'Gross Weight', description: 'Gross weight in grams' },
  netWeight: { display: 'Net Weight', description: 'Net weight in grams' },
  metalRate: { display: 'Metal Rate', description: 'Current metal price per gram' },
  metalCost: { display: 'Metal Cost', description: 'Auto-calculated: netWeight × metalRate' },
  subtotal: { display: 'Subtotal', description: 'Sum of components before this one' },
}

// Available operators
export const OPERATORS = {
  add: { display: '+', symbol: '+' },
  subtract: { display: '−', symbol: '-' },
  multiply: { display: '×', symbol: '*' },
  divide: { display: '÷', symbol: '/' },
  openParen: { display: '(', symbol: '(' },
  closeParen: { display: ')', symbol: ')' },
}

// Quick-start templates for common jewelry pricing scenarios
export interface FormulaTemplate {
  name: string
  description: string
  chips: string[]
  formula: string
  category: 'basic' | 'wastage' | 'making' | 'advanced'
}

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    name: 'Basic Metal Cost',
    description: 'Simple calculation: netWeight × metalRate',
    chips: ['netWeight', '×', 'metalRate'],
    formula: 'netWeight × metalRate',
    category: 'basic',
  },
  {
    name: 'Wastage Charges',
    description: 'Wastage: (grossWeight - netWeight) × metalRate',
    chips: ['(', 'grossWeight', '−', 'netWeight', ')', '×', 'metalRate'],
    formula: '(grossWeight - netWeight) × metalRate',
    category: 'wastage',
  },
  {
    name: 'Wastage with Percentage',
    description: 'Wastage with custom rate: (grossWeight - netWeight) × metalRate × 1.05',
    chips: ['(', 'grossWeight', '−', 'netWeight', ')', '×', 'metalRate', '×', '1.05'],
    formula: '(grossWeight - netWeight) × metalRate × 1.05',
    category: 'wastage',
  },
  {
    name: 'Making Charges (Fixed per Gram)',
    description: 'Fixed making: netWeight × 50',
    chips: ['netWeight', '×', '50'],
    formula: 'netWeight × 50',
    category: 'making',
  },
  {
    name: 'Making Charges (% of Metal)',
    description: 'Making as percentage: metalCost × 0.15',
    chips: ['metalCost', '×', '0.15'],
    formula: 'metalCost × 0.15',
    category: 'making',
  },
  {
    name: 'Complex Making Formula',
    description: 'Tiered making: (netWeight × 100) + (metalCost × 0.05)',
    chips: ['(', 'netWeight', '×', '100', ')', '+', '(', 'metalCost', '×', '0.05', ')'],
    formula: '(netWeight × 100) + (metalCost × 0.05)',
    category: 'advanced',
  },
  {
    name: 'GST Calculation',
    description: 'GST on subtotal: subtotal × 0.03',
    chips: ['subtotal', '×', '0.03'],
    formula: 'subtotal × 0.03',
    category: 'basic',
  },
]

// Test context for formula validation
export interface FormulaContext {
  grossWeight?: number
  netWeight?: number
  metalRate?: number
  metalCost?: number
  subtotal?: number
}

export const DEFAULT_TEST_CONTEXT: FormulaContext = {
  grossWeight: 10,
  netWeight: 9.5,
  metalRate: 5000,
  metalCost: 47500,
  subtotal: 50000,
}
