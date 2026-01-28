import { describe, it, expect } from 'vitest'
import {
  validateFormula,
  chipsToFormula,
  formulaToChips,
  formatNumber,
} from '../utils/formulaValidator'
import { DEFAULT_TEST_CONTEXT } from '../utils/formulaTypes'

describe('Formula Validator', () => {
  describe('validateFormula', () => {
    it('should validate a simple formula', () => {
      const result = validateFormula('netWeight × metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.result).toBe(47500) // 9.5 × 5000
    })

    it('should detect empty formula', () => {
      const result = validateFormula('', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Formula cannot be empty')
    })

    it('should detect unknown variables', () => {
      const result = validateFormula('unknownVar × metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Unknown variable'))).toBe(true)
    })

    it('should detect unbalanced parentheses', () => {
      const result = validateFormula('(netWeight × metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Unbalanced parentheses'))).toBe(true)
    })

    it('should detect consecutive operators', () => {
      const result = validateFormula('netWeight ×× metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('consecutive operators'))).toBe(true)
    })

    it('should validate complex formula with parentheses', () => {
      const result = validateFormula('(grossWeight − netWeight) × metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(true)
      expect(result.result).toBe(2500) // (10 - 9.5) × 5000
    })

    it('should warn about division by zero', () => {
      const result = validateFormula('metalRate ÷ netWeight', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('division by zero'))).toBe(true)
    })

    it('should warn about negative results', () => {
      const result = validateFormula('netWeight − grossWeight', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(true)
      expect(result.warnings.some(w => w.includes('negative'))).toBe(true)
    })

    it('should handle decimal numbers', () => {
      const result = validateFormula('netWeight × 0.15', DEFAULT_TEST_CONTEXT)
      expect(result.isValid).toBe(true)
      expect(result.result).toBe(1.425) // 9.5 × 0.15
    })

    it('should provide calculation steps', () => {
      const result = validateFormula('netWeight × metalRate', DEFAULT_TEST_CONTEXT)
      expect(result.steps).toBeDefined()
      expect(result.steps!.length).toBeGreaterThan(0)
      expect(result.steps![0]).toContain('Original')
    })
  })

  describe('chipsToFormula', () => {
    it('should convert chips array to formula string', () => {
      const chips = ['netWeight', '×', 'metalRate']
      const formula = chipsToFormula(chips)
      expect(formula).toBe('netWeight × metalRate')
    })

    it('should handle empty array', () => {
      const formula = chipsToFormula([])
      expect(formula).toBe('')
    })

    it('should handle single chip', () => {
      const formula = chipsToFormula(['100'])
      expect(formula).toBe('100')
    })
  })

  describe('formulaToChips', () => {
    it('should convert formula string to chips array', () => {
      const chips = formulaToChips('netWeight × metalRate')
      expect(chips).toEqual(['netWeight', '×', 'metalRate'])
    })

    it('should handle empty string', () => {
      const chips = formulaToChips('')
      expect(chips).toEqual([])
    })

    it('should handle formula with parentheses', () => {
      const chips = formulaToChips('( netWeight + 10 ) × metalRate')
      expect(chips).toEqual(['(', 'netWeight', '+', '10', ')', '×', 'metalRate'])
    })
  })

  describe('formatNumber', () => {
    it('should format number with default 2 decimals', () => {
      const formatted = formatNumber(1234.567)
      // en-IN locale uses comma as thousands separator
      expect(formatted).toMatch(/1,234\.57/)
    })

    it('should format number with custom decimals', () => {
      const formatted = formatNumber(1234.567, 1)
      expect(formatted).toMatch(/1,234\.6/)
    })

    it('should format zero', () => {
      const formatted = formatNumber(0)
      expect(formatted).toMatch(/0\.00/)
    })
  })
})
