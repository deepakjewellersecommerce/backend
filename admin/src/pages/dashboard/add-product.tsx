import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ProductFormV2 from '../../components/products/product-form-v2'
import type { ProductFormData } from '../../types/product'

export default function AddProduct() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [initialData, setInitialData] = useState<Partial<ProductFormData>>()
  const isEditMode = !!id

  useEffect(() => {
    // Fetch product data if in edit mode
    if (id) {
      fetchProduct(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchProduct = async (productId: string) => {
    try {
      setIsLoading(true)
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/product/${productId}`)
      // const data = await response.json()
      setInitialData({} /* data.product */)
      
      console.log('Fetching product:', productId)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (data: ProductFormData) => {
    try {
      setIsLoading(true)
      
      // TODO: Replace with actual API call
      if (isEditMode) {
        // Update existing product
        console.log('Updating product:', id, data)
        // await fetch(`/api/product/${id}`, {
        //   method: 'PUT',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(data),
        // })
      } else {
        // Create new product
        console.log('Creating product:', data)
        // await fetch('/api/product', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(data),
        // })
      }

      // Navigate back to product list
      navigate('/dashboard/products')
    } catch (error) {
      console.error('Error saving product:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="mt-2 text-gray-600">
            {isEditMode 
              ? 'Update the product information below.' 
              : 'Fill in the details to create a new product.'}
          </p>
        </div>

        {isLoading && isEditMode ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p>Loading product data...</p>
          </div>
        ) : (
          <ProductFormV2
            initialData={initialData}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}
