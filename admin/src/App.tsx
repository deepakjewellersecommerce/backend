import { Routes, Route } from 'react-router-dom'
import AddProduct from './pages/dashboard/add-product'
import ProductList from './pages/dashboard/product-list'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/dashboard/products" element={<ProductList />} />
        <Route path="/dashboard/products/add" element={<AddProduct />} />
        <Route path="/dashboard/products/edit/:id" element={<AddProduct />} />
      </Routes>
    </div>
  )
}

export default App
