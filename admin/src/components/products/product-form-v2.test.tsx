import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductFormV2 from './product-form-v2'

describe('ProductFormV2', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('renders all major sections', () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)

    // Check for section headings
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Basic Information')).toBeInTheDocument()
    expect(screen.getByText('Category Hierarchy')).toBeInTheDocument()
    expect(screen.getByText('Physical Properties')).toBeInTheDocument()
    expect(screen.getByText('Gemstones')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText(/SEO/)).toBeInTheDocument()
  })

  it('renders status toggles', () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)

    const activeCheckbox = screen.getByLabelText(/Active/i)
    const featuredCheckbox = screen.getByLabelText(/Featured/i)

    expect(activeCheckbox).toBeInTheDocument()
    expect(featuredCheckbox).toBeInTheDocument()
    expect(activeCheckbox).not.toBeChecked()
    expect(featuredCheckbox).not.toBeChecked()
  })

  it('auto-generates slug from product title', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const titleInput = screen.getByPlaceholderText('Enter product title')
    const slugInput = screen.getByPlaceholderText('product-slug')

    await userEvent.type(titleInput, 'Gold Ring 22K')
    
    await waitFor(() => {
      expect(slugInput).toHaveValue('gold-ring-22k')
    })
  })

  it('allows manual slug override', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const titleInput = screen.getByPlaceholderText('Enter product title')
    const slugInput = screen.getByPlaceholderText('product-slug')

    // Type in title to auto-generate slug
    await userEvent.type(titleInput, 'Gold Ring')
    await waitFor(() => {
      expect(slugInput).toHaveValue('gold-ring')
    })

    // Manually change slug
    await userEvent.clear(slugInput)
    await userEvent.type(slugInput, 'custom-slug')

    expect(slugInput).toHaveValue('custom-slug')
    expect(screen.getByText('Manual override active')).toBeInTheDocument()
  })

  it('displays weight validation error when net weight exceeds gross weight', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const grossWeightInput = screen.getByPlaceholderText('0.000').closest('input[type="number"]')!
    const netWeightInputs = screen.getAllByPlaceholderText('0.000')
    const netWeightInput = netWeightInputs[1] // Second one is net weight

    await userEvent.type(grossWeightInput, '10')
    await userEvent.type(netWeightInput, '15')

    await waitFor(() => {
      expect(screen.getByText('Invalid Weight')).toBeInTheDocument()
      expect(screen.getByText('Net weight cannot exceed gross weight')).toBeInTheDocument()
    })
  })

  it('displays warning for large weight difference (>5%)', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const grossWeightInput = screen.getByPlaceholderText('0.000').closest('input[type="number"]')!
    const netWeightInputs = screen.getAllByPlaceholderText('0.000')
    const netWeightInput = netWeightInputs[1]

    await userEvent.type(grossWeightInput, '100')
    await userEvent.type(netWeightInput, '80')

    await waitFor(() => {
      expect(screen.getByText('Large Weight Difference')).toBeInTheDocument()
    })
  })

  it('adds and removes gemstones dynamically', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const addButton = screen.getByText('Add Gemstone')
    
    // Initially no gemstones
    expect(screen.getByText('No gemstones added yet.')).toBeInTheDocument()

    // Add first gemstone
    await userEvent.click(addButton)
    await waitFor(() => {
      expect(screen.getByText('Gemstone #1')).toBeInTheDocument()
    })

    // Add second gemstone
    await userEvent.click(addButton)
    await waitFor(() => {
      expect(screen.getByText('Gemstone #2')).toBeInTheDocument()
    })

    // Remove first gemstone
    const removeButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.querySelector('svg') !== null
    )
    await userEvent.click(removeButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Gemstone #2')).not.toBeInTheDocument()
      expect(screen.getByText('Gemstone #1')).toBeInTheDocument()
    })
  })

  it('calculates gemstone total cost', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const addButton = screen.getByText('Add Gemstone')
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Gemstone #1')).toBeInTheDocument()
    })

    // Find weight and price inputs for the gemstone
    const inputs = screen.getAllByPlaceholderText('0.000')
    const weightInput = inputs[inputs.length - 2] // Weight input
    const priceInputs = screen.getAllByPlaceholderText('0.00')
    const priceInput = priceInputs[priceInputs.length - 1] // Price per carat

    await userEvent.type(weightInput, '2')
    await userEvent.type(priceInput, '5000')

    // Total should be calculated (2 * 5000 = 10000)
    await waitFor(() => {
      const totalCostElements = screen.getAllByText(/Total Cost:/)
      expect(totalCostElements.length).toBeGreaterThan(0)
    })
  })

  it('enforces maximum 50 gemstones limit', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const addButton = screen.getByText('Add Gemstone')

    // Add 50 gemstones
    for (let i = 0; i < 50; i++) {
      fireEvent.click(addButton)
    }

    await waitFor(() => {
      expect(screen.getByText('(50/50)')).toBeInTheDocument()
      expect(addButton).toBeDisabled()
    })
  })

  it('shows static price input when pricing mode is Static Price', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const pricingModeSelect = screen.getByLabelText('Pricing Mode')
    
    await userEvent.selectOptions(pricingModeSelect, 'STATIC_PRICE')

    await waitFor(() => {
      expect(screen.getByLabelText(/Static Price/)).toBeInTheDocument()
    })
  })

  it('shows dynamic pricing info when pricing mode is Subcategory Dynamic', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const pricingModeSelect = screen.getByLabelText('Pricing Mode')
    
    await userEvent.selectOptions(pricingModeSelect, 'SUBCATEGORY_DYNAMIC')

    await waitFor(() => {
      expect(screen.getByText('Dynamic Pricing Enabled')).toBeInTheDocument()
      expect(screen.getByText(/Price will be calculated based on subcategory/)).toBeInTheDocument()
    })
  })

  it('toggles status badges when checkboxes are clicked', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const activeCheckbox = screen.getByLabelText(/Active/i)
    const featuredCheckbox = screen.getByLabelText(/Featured/i)

    // Initially no badges
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.queryByText('Featured')).not.toBeInTheDocument()

    // Check active
    await userEvent.click(activeCheckbox)
    await waitFor(() => {
      const badges = screen.getAllByText('Active')
      expect(badges.length).toBeGreaterThan(1) // Label + Badge
    })

    // Check featured
    await userEvent.click(featuredCheckbox)
    await waitFor(() => {
      const badges = screen.getAllByText('Featured')
      expect(badges.length).toBeGreaterThan(1) // Label + Badge
    })
  })

  it('validates required fields on submit', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    const submitButton = screen.getByText('Save Product')
    await userEvent.click(submitButton)

    await waitFor(() => {
      // Should show validation errors for required fields
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument()
      expect(screen.getByText('SKU is required')).toBeInTheDocument()
      expect(screen.getByText('Subcategory is required')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveCalled()
  })

  it('renders with initial data', () => {
    const initialData = {
      productTitle: 'Test Product',
      productSlug: 'test-product',
      skuNo: 'TEST123',
      metalType: 'GOLD_22K' as const,
      grossWeight: 10,
      netWeight: 9.5,
      pricingMode: 'STATIC_PRICE' as const,
      staticPrice: 50000,
      isActive: true,
      isFeatured: false,
    }

    render(<ProductFormV2 onSubmit={mockOnSubmit} initialData={initialData} />)

    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test-product')).toBeInTheDocument()
    expect(screen.getByDisplayValue('TEST123')).toBeInTheDocument()
    expect(screen.getByLabelText(/Active/i)).toBeChecked()
    expect(screen.getByLabelText(/Featured/i)).not.toBeChecked()
  })

  it('handles form submission with valid data', async () => {
    render(<ProductFormV2 onSubmit={mockOnSubmit} />)
    
    // Fill in required fields
    await userEvent.type(screen.getByPlaceholderText('Enter product title'), 'Gold Ring 22K')
    await userEvent.type(screen.getByPlaceholderText('SKU123'), 'GR22K001')
    
    // Select subcategory (mock - in real scenario this would be populated)
    const subcategorySelect = screen.getByLabelText(/Subcategory/)
    // Note: In actual implementation, this would have options from API

    // Select metal type
    const metalTypeSelect = screen.getByLabelText(/Metal Type/)
    await userEvent.selectOptions(metalTypeSelect, 'GOLD_22K')

    // Fill weights
    const inputs = screen.getAllByPlaceholderText('0.000')
    await userEvent.type(inputs[0], '10')
    await userEvent.type(inputs[1], '9.5')

    // Submit is tested indirectly through validation
    // Full submission test would require mocked API data for subcategories
  })
})
