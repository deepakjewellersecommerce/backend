import { FORMULA_VARIABLES, FormulaContext, DEFAULT_TEST_CONTEXT } from './formulaTypes'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  result?: number
  steps?: string[]
}

/**
 * Validates a formula for syntax errors and safety issues
 */
export function validateFormula(
  formula: string,
  context: FormulaContext = DEFAULT_TEST_CONTEXT
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const steps: string[] = []

  // Empty formula
  if (!formula || formula.trim() === '') {
    return { isValid: false, errors: ['Formula cannot be empty'], warnings: [], steps: [] }
  }

  // Check for valid variables
  const validVariables = Object.keys(FORMULA_VARIABLES)
  const variablePattern = /[a-zA-Z]+/g
  const usedVariables = formula.match(variablePattern) || []
  
  for (const variable of usedVariables) {
    if (!validVariables.includes(variable) && isNaN(parseFloat(variable))) {
      errors.push(`Unknown variable: "${variable}"`)
    }
  }

  // Check for balanced parentheses
  let parenCount = 0
  for (const char of formula) {
    if (char === '(') parenCount++
    if (char === ')') parenCount--
    if (parenCount < 0) {
      errors.push('Unbalanced parentheses: closing ")" without opening "("')
      break
    }
  }
  if (parenCount > 0) {
    errors.push('Unbalanced parentheses: missing closing ")"')
  }

  // Check for consecutive operators
  if (/[+\-×÷*/]{2,}/.test(formula)) {
    errors.push('Invalid syntax: consecutive operators')
  }

  // Check for operators at start/end (except minus for negative numbers)
  if (/^[+×÷*/]/.test(formula.trim())) {
    errors.push('Formula cannot start with an operator (except -)')
  }
  if (/[+\-×÷*/]$/.test(formula.trim())) {
    errors.push('Formula cannot end with an operator')
  }

  // If there are syntax errors, return early
  if (errors.length > 0) {
    return { isValid: false, errors, warnings, steps }
  }

  // Test calculation with provided context
  try {
    const testContext = { ...DEFAULT_TEST_CONTEXT, ...context }
    
    // Convert formula to JavaScript expression
    let jsFormula = formula
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')

    // Record original formula
    steps.push(`Original: ${formula}`)

    // Replace variables with values
    let substituted = jsFormula
    for (const [variable, value] of Object.entries(testContext)) {
      const regex = new RegExp(`\\b${variable}\\b`, 'g')
      substituted = substituted.replace(regex, String(value))
    }
    steps.push(`Substituted: ${substituted}`)

    // Evaluate using Function constructor (safer than eval)
    const evaluate = new Function('return ' + substituted)
    const result = evaluate()

    steps.push(`Result: ${result}`)

    // Check for invalid results
    if (isNaN(result)) {
      errors.push('Formula produces NaN (Not a Number)')
      return { isValid: false, errors, warnings, steps }
    }

    if (!isFinite(result)) {
      errors.push('Formula produces Infinity (possible division by zero)')
      return { isValid: false, errors, warnings, steps }
    }

    // Test for division by zero with edge cases
    const zeroContext = {
      grossWeight: 0,
      netWeight: 0,
      metalRate: 0,
      metalCost: 0,
      subtotal: 0,
    }

    let zeroFormula = jsFormula
    for (const [variable, value] of Object.entries(zeroContext)) {
      const regex = new RegExp(`\\b${variable}\\b`, 'g')
      zeroFormula = zeroFormula.replace(regex, String(value))
    }

    try {
      const zeroEval = new Function('return ' + zeroFormula)
      const zeroResult = zeroEval()
      
      if (!isFinite(zeroResult) && zeroResult !== 0) {
        warnings.push('Formula may cause division by zero with zero inputs')
      }
    } catch (e) {
      warnings.push('Formula may have issues with zero values')
    }

    // Warning for very large numbers
    if (Math.abs(result) > 1000000) {
      warnings.push('Result is very large - please verify formula')
    }

    // Warning for negative results
    if (result < 0) {
      warnings.push('Result is negative - this may be intentional')
    }

    return {
      isValid: true,
      errors: [],
      warnings,
      result,
      steps,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Calculation error: ${errorMessage}`)
    return { isValid: false, errors, warnings, steps }
  }
}

/**
 * Converts an array of chip values to a formula string
 */
export function chipsToFormula(chips: string[]): string {
  return chips.join(' ').trim()
}

/**
 * Converts a formula string to an array of chips
 */
export function formulaToChips(formula: string): string[] {
  if (!formula) return []
  
  // Split by spaces and filter out empty strings
  return formula
    .split(/\s+/)
    .filter(chip => chip.trim() !== '')
}

/**
 * Format a number for display
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
