import { useState, useEffect, useCallback } from 'react'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
} from 'firebase/firestore'
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
} from 'firebase/auth'

// ─── Firebase globals (injected by hosting platform or .env) ───
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

const appId = typeof __app_id !== 'undefined'
  ? __app_id
  : import.meta.env.VITE_APP_ID || 'poovi-ecommerce'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const FALLBACK_PRODUCTS_URL = `${import.meta.env.BASE_URL}products.json`

// Fetch with timeout — Render free tier can take up to 60s to wake up
async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// ─── Utility: format price in Indian Rupees ───
const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ─── Utility: debounce function to delay search filtering ───
function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// ─── ProductCard: renders a single product with Add to Cart ───
function ProductCard({ product, onAddToCart }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium capitalize text-brand-600 shadow-sm backdrop-blur">
          {product.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 text-center">
        <h3 className="mb-1 text-lg font-semibold text-slate-800">{product.name}</h3>
        <p className="mb-3 flex-1 text-sm leading-relaxed text-slate-500">{product.description}</p>
        <p className="mb-4 text-xl font-bold text-brand-600">{formatCurrency(product.price)}</p>
        <button
          onClick={() => onAddToCart(product)}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-700 active:scale-95"
        >
          Add to Cart
        </button>
      </div>
    </div>
  )
}

// ─── Cart: displays cart items and total ───
function Cart({ cartItems, onClose, onCheckout }) {
  const grandTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-[slideIn_0.3s_ease-out]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">Your Cart</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close cart"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartItems.length === 0 ? (
            <p className="py-12 text-center text-slate-400">Your cart is empty</p>
          ) : (
            <ul className="space-y-4">
              {cartItems.map((item) => (
                <li key={item.id} className="flex items-center gap-4 rounded-xl border border-slate-100 p-3">
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-brand-600">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-medium text-slate-600">Total</span>
              <span className="text-2xl font-bold text-brand-600">{formatCurrency(grandTotal)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98]"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

// ─── CheckoutForm: collects user details for order placement ───
function CheckoutForm({ cartItems, onPlaceOrder, onCancel }) {
  const [formData, setFormData] = useState({ fullName: '', address: '', email: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const grandTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const validate = () => {
    const newErrors = {}
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!formData.address.trim()) newErrors.address = 'Address is required'
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    await onPlaceOrder(formData, grandTotal)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl"
      >
        <h2 className="mb-6 text-2xl font-bold text-slate-800">Checkout</h2>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Full Name</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="John Doe"
          />
          {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="123 Main St, City, State"
          />
          {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="john@example.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>

        <div className="mb-6 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <span className="font-medium text-slate-600">Order Total</span>
          <span className="text-xl font-bold text-brand-600">{formatCurrency(grandTotal)}</span>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Recommendations: shows related products by category ───
function Recommendations({ products, onAddToCart }) {
  if (!products.length) return null

  return (
    <section className="mt-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-800">You May Also Like</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
        ))}
      </div>
    </section>
  )
}

// ─── Main App Component ───
function App() {
  const [PRODUCTS, setPRODUCTS] = useState([])
  const [loading, setLoading] = useState(true)
  const [cartItems, setCartItems] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckout, setIsCheckout] = useState(false)
  const [recommendedProducts, setRecommendedProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState([])
  const [orderMessage, setOrderMessage] = useState('')
  const [db, setDb] = useState(null)
  const [userId, setUserId] = useState(null)

  // Load products instantly from JSON, then silently refresh from live API
  const loadProducts = async () => {
    setLoading(true)

    try {
      const res = await fetch(FALLBACK_PRODUCTS_URL)
      if (res.ok) {
        const data = await res.json()
        setPRODUCTS(data)
        setFilteredProducts(data)
      }
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setLoading(false)
    }

    // Silently upgrade to live database products when API is available
    try {
      const res = await fetchWithTimeout(`${API_BASE}/products/`, 30000)
      if (res.ok) {
        const data = await res.json()
        setPRODUCTS(data)
        setFilteredProducts(data)
      }
    } catch {
      // API unavailable — cached products already shown
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  // Initialize Firebase and authenticate user
  useEffect(() => {
    if (!firebaseConfig?.apiKey) {
      console.warn('Firebase not configured. Orders will not be saved.')
      return
    }

    const app = initializeApp(firebaseConfig)
    const firestore = getFirestore(app)
    const auth = getAuth(app)
    setDb(firestore)

    const signIn = async () => {
      try {
        let userCredential
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          userCredential = await signInWithCustomToken(auth, __initial_auth_token)
        } else {
          userCredential = await signInAnonymously(auth)
        }
        setUserId(userCredential.user.uid)
      } catch (err) {
        console.error('Firebase auth error:', err)
      }
    }
    signIn()
  }, [])

  // Debounced search: filters products by name and description (case-insensitive)
  const filterProducts = useCallback(
    debounce((term, products) => {
      if (!term.trim()) {
        setFilteredProducts(products)
        return
      }
      const lower = term.toLowerCase()
      const results = products.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.category?.toLowerCase().includes(lower)
      )
      setFilteredProducts(results)
    }, 300),
    []
  )

  // Re-run search filter when searchTerm or PRODUCTS change
  useEffect(() => {
    filterProducts(searchTerm, PRODUCTS)
  }, [searchTerm, PRODUCTS, filterProducts])

  // Generate product recommendations based on category
  const generateRecommendations = (category) => {
    const recs = PRODUCTS.filter(
      (p) => p.category === category && !cartItems.some((c) => c.id === p.id)
    ).slice(0, 4)
    setRecommendedProducts(recs)
  }

  // Add to cart — increments quantity if item already exists
  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    generateRecommendations(product.category)
  }

  // Place order — saves to Firestore and clears cart
  const handlePlaceOrder = async (formData, grandTotal) => {
    const newOrder = {
      ...formData,
      cartItems,
      grandTotal,
      createdAt: new Date().toISOString(),
    }

    try {
      if (db && userId) {
        const ordersRef = collection(db, 'artifacts', appId, 'users', userId, 'orders')
        await addDoc(ordersRef, newOrder)
        console.log('Order placed successfully!', newOrder)
      } else {
        console.log('Order placed (demo mode — Firebase not configured):', newOrder)
      }

      setCartItems([])
      setIsCheckout(false)
      setIsCartOpen(false)
      setOrderMessage('🎉 Order placed successfully! Thank you for shopping with us.')
      setTimeout(() => setOrderMessage(''), 5000)
    } catch (err) {
      console.error('Error placing order:', err)
      setOrderMessage('❌ Failed to place order. Please try again.')
      setTimeout(() => setOrderMessage(''), 5000)
    }
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/20 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Poovi Shop</h1>
              <p className="hidden text-xs text-slate-400 sm:block">Premium E-Commerce</p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:max-w-sm"
            />

            <button
              onClick={() => setIsCartOpen((prev) => !prev)}
              className="relative rounded-xl bg-brand-50 p-2.5 text-brand-600 transition-all hover:bg-brand-100 active:scale-95"
              aria-label="Toggle cart"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Order confirmation toast */}
      {orderMessage && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-[fadeIn_0.3s_ease-out] rounded-xl bg-white px-6 py-4 text-center font-medium text-slate-700 shadow-2xl ring-1 ring-slate-200">
          {orderMessage}
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">Discover Our Collection</h2>
          <p className="mt-2 text-slate-500">Curated products for every lifestyle</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="text-sm text-slate-400">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-4 text-lg text-slate-400">No products found.</p>
            <button
              onClick={loadProducts}
              className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white transition-all hover:bg-brand-700"
            >
              Reload
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}

        {!loading && filteredProducts.length > 0 && recommendedProducts.length > 0 && (
          <Recommendations
            products={recommendedProducts}
            onAddToCart={handleAddToCart}
          />
        )}
      </main>

      {/* Cart sidebar */}
      {isCartOpen && (
        <Cart
          cartItems={cartItems}
          onClose={() => setIsCartOpen(false)}
          onCheckout={() => {
            setIsCartOpen(false)
            setIsCheckout(true)
          }}
        />
      )}

      {/* Checkout form */}
      {isCheckout && (
        <CheckoutForm
          cartItems={cartItems}
          onPlaceOrder={handlePlaceOrder}
          onCancel={() => setIsCheckout(false)}
        />
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200/60 bg-white/60 py-8 text-center text-sm text-slate-400">
        <p>&copy; {new Date().getFullYear()} Poovi Shop. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}

export default App
