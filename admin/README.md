# Admin Frontend - Formula Builder

Visual, chip-based formula builder for the jewelry pricing system.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

### 🎨 Chip-based UI
- Color-coded chips for variables (blue), operators (orange), numbers (purple)
- Smooth animations and transitions
- Responsive layout

### 👆 Interactive Gestures
- **Desktop**: Hover to show delete icon, click to delete
- **Mobile**: Swipe left to delete with visual feedback
- **Keyboard**: Tab navigation, Enter/Space to delete

### ✅ Real-time Validation
- Immediate syntax checking
- Division by zero detection
- Invalid variable warnings
- Balanced parentheses validation
- Test calculation with sample values

### 📊 Calculation Breakdown
- Expandable accordion UI
- Input values display with formatting
- Step-by-step evaluation trace
- Error and warning sections
- Success indicators

### 🚀 Quick-Start Templates
7 pre-configured templates:
- Basic Metal Cost
- Wastage Charges
- Wastage with Percentage
- Making Charges (Fixed per Gram)
- Making Charges (% of Metal)
- Complex Making Formula
- GST Calculation

## Usage

### Basic Example

```tsx
import { FormulaBuilder } from '@/components/formula-builder'
import { useState } from 'react'

function MyForm() {
  const [chips, setChips] = useState<string[]>([])
  
  return (
    <FormulaBuilder
      value={chips}
      onChange={setChips}
      showTemplates={true}
      showBreakdown={true}
    />
  )
}
```

### With Custom Context

```tsx
<FormulaBuilder
  value={chips}
  onChange={setChips}
  context={{
    grossWeight: 12.5,
    netWeight: 11.8,
    metalRate: 6500,
    metalCost: 76700,
    subtotal: 85000,
  }}
/>
```

### Backend Integration

The formula builder generates two outputs:

```typescript
{
  formula: "(grossWeight − netWeight) × metalRate × 1.05",
  formulaChips: ["(", "grossWeight", "−", "netWeight", ")", "×", "metalRate", "×", "1.05"]
}
```

These map directly to backend models:
- `models/subcategory-pricing.model.js`
- `models/price-component.model.js`
- `models/product.model.js`

## Components

### FormulaBuilder
Main component with templates and validation.

**Props:**
- `value: string[]` - Array of chip values
- `onChange: (chips: string[]) => void` - Change handler
- `context?: FormulaContext` - Test values for validation
- `showTemplates?: boolean` - Show template panel (default: true)
- `showBreakdown?: boolean` - Show calculation breakdown (default: true)
- `disabled?: boolean` - Disable editing (default: false)

### FormulaInput
Chip-based input field with picker panel.

**Props:**
- `chips: string[]` - Current chips
- `onChange: (chips: string[]) => void` - Change handler
- `placeholder?: string` - Placeholder text
- `disabled?: boolean` - Disable editing
- `showValidation?: boolean` - Show validation feedback (default: true)

### FormulaChip
Individual chip component.

**Props:**
- `value: string` - Chip text
- `type: 'variable' | 'operator' | 'number' | 'function'` - Chip type
- `onDelete?: () => void` - Delete handler
- `onHover?: (hovering: boolean) => void` - Hover handler

### CalculationBreakdown
Accordion display for calculation steps.

**Props:**
- `formula: string` - Formula to evaluate
- `context: FormulaContext` - Input values

## Available Variables

- `grossWeight` - Gross weight in grams
- `netWeight` - Net weight in grams
- `metalRate` - Current metal price per gram
- `metalCost` - Auto-calculated: netWeight × metalRate
- `subtotal` - Sum of components before this one

## Testing

### Run Tests

```bash
npm test                 # Run all tests
npm run test:ui          # Interactive UI
npm run test:coverage    # Coverage report
```

### Test Coverage

- **70 tests** across 5 test files
- Unit and integration tests
- Component isolation
- Edge case handling
- Accessibility testing

### Test Files

1. `formulaValidator.test.ts` - Validation logic (19 tests)
2. `FormulaChip.test.tsx` - Chip component (11 tests)
3. `FormulaInput.test.tsx` - Input component (13 tests)
4. `CalculationBreakdown.test.tsx` - Breakdown component (12 tests)
5. `FormulaBuilder.test.tsx` - Main component (15 tests)

## Development

### Project Structure

```
admin/
├── src/
│   ├── components/
│   │   └── formula-builder/
│   │       ├── FormulaChip.tsx
│   │       ├── FormulaInput.tsx
│   │       ├── CalculationBreakdown.tsx
│   │       ├── FormulaBuilder.tsx
│   │       └── index.ts
│   ├── pages/
│   │   └── dashboard/
│   │       ├── SubcategoryPricingForm.tsx
│   │       └── PriceComponentForm.tsx
│   ├── utils/
│   │   ├── formulaTypes.ts
│   │   └── formulaValidator.ts
│   ├── test/
│   │   ├── setup.ts
│   │   └── *.test.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### Tech Stack

- **React 18.2** - UI framework
- **TypeScript 5.3** - Type safety
- **Vite 5.0** - Build tool
- **Vitest 1.0** - Test runner
- **React Testing Library** - Component testing

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari (mobile gestures)
- Chrome Mobile (mobile gestures)

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, Space)
- Focus management
- Screen reader compatible
- High contrast color schemes

## Security

- Input validation for all user input
- Safe formula evaluation (no eval())
- XSS protection via React
- 0 CodeQL security alerts

## Performance

- Component render: <16ms
- Formula validation: <5ms
- Test execution: <3 seconds
- Bundle size: ~51KB gzipped

## Contributing

1. Write tests for new features
2. Ensure all tests pass: `npm test`
3. Build successfully: `npm run build`
4. Follow TypeScript strict mode
5. Add JSDoc comments for public APIs

## License

Part of the Deepak Jewellers E-commerce system.
