import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth'

// ─── Firebase config ───
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

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const getProductImage = (image) =>
  image.startsWith('http') ? image : `${import.meta.env.BASE_URL}${image}`

// ─── Header with mobile toggle menu ───
function Header({ cartCount, searchTerm, onSearchChange, onCartToggle }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/products', label: 'Products' },
    { to: '/about', label: 'About Us' },
  ]

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 py-4">
          <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Poovi Shop</h1>
              <p className="hidden text-xs text-slate-400 sm:block">Premium E-Commerce</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-brand-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="hidden w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:block lg:w-52"
            />

            <button
              onClick={onCartToggle}
              className="relative rounded-xl bg-brand-50 p-2.5 text-brand-600 transition-all hover:bg-brand-100 active:scale-95"
              aria-label="Toggle cart"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <nav className="border-t border-slate-100 py-3 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 px-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

// ─── ProductCard ───
function ProductCard({ product, onAddToCart }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
      <Link to={`/products/${product.id}`} className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={getProductImage(product.image)}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium capitalize text-brand-600 shadow-sm backdrop-blur">
          {product.category}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5 text-center">
        <Link to={`/products/${product.id}`} className="mb-1 text-lg font-semibold text-slate-800 hover:text-brand-600">
          {product.name}
        </Link>
        <p className="mb-3 flex-1 text-sm leading-relaxed text-slate-500 line-clamp-2">{product.description}</p>
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

// ─── Cart with quantity controls ───
function Cart({ cartItems, onClose, onCheckout, onIncrease, onDecrease, onRemove }) {
  const grandTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-[slideIn_0.3s_ease-out]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">Your Cart</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close cart">
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
                <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <img src={getProductImage(item.image)} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.id}`} onClick={onClose} className="font-medium text-slate-800 hover:text-brand-600 truncate block">
                        {item.name}
                      </Link>
                      <p className="text-sm text-brand-600 font-semibold">{formatCurrency(item.price)}</p>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove item"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDecrease(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-medium text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => onIncrease(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-semibold text-slate-800">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
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

// ─── CheckoutForm ───
function CheckoutForm({ cartItems, onPlaceOrder, onCancel }) {
  const [formData, setFormData] = useState({ fullName: '', address: '', email: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const grandTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

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
      <form onSubmit={handleSubmit} className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold text-slate-800">Checkout</h2>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Full Name</label>
          <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="John Doe" />
          {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Address</label>
          <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="123 Main St, City, State" />
          {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="john@example.com" />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>
        <div className="mb-6 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <span className="font-medium text-slate-600">Order Total</span>
          <span className="text-xl font-bold text-brand-600">{formatCurrency(grandTotal)}</span>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Home Page ───
function HomePage({ products, onAddToCart }) {
  const featured = products.slice(0, 4)

  return (
    <div>
      <section className="mb-12 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <h2 className="text-3xl font-bold sm:text-5xl">Welcome to Poovi Shop</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-100">
          Discover premium products curated for every lifestyle — electronics, fashion, fitness, and more.
        </p>
        <Link to="/products" className="mt-8 inline-block rounded-xl bg-white px-8 py-3 font-semibold text-brand-600 transition-all hover:bg-brand-50 hover:shadow-lg">
          Shop Now
        </Link>
      </section>

      {featured.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Featured Products</h2>
            <Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">View All →</Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Products Page ───
function ProductsPage({ loading, filteredProducts, onAddToCart, onReload, recommendedProducts }) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">Our Products</h2>
        <p className="mt-2 text-slate-500">Browse our full collection</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-slate-400">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-4 text-lg text-slate-400">No products found.</p>
          <button onClick={onReload} className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">Reload</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      )}

      {!loading && recommendedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">You May Also Like</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendedProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Product Detail Page ───
function ProductDetailPage({ products, onAddToCart }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = products.find((p) => String(p.id) === String(id))

  if (!product) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-lg text-slate-400">Product not found.</p>
        <Link to="/products" className="text-brand-600 hover:text-brand-700 font-medium">← Back to Products</Link>
      </div>
    )
  }

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        ← Back
      </button>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img
            src={getProductImage(product.image)}
            alt={product.name}
            className="aspect-square w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex flex-col">
          <span className="mb-2 inline-block w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-medium capitalize text-brand-600">
            {product.category}
          </span>
          <h1 className="text-3xl font-bold text-slate-800 sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-3xl font-bold text-brand-600">{formatCurrency(product.price)}</p>
          <p className="mt-6 flex-1 text-lg leading-relaxed text-slate-600">{product.description}</p>

          {product.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{tag}</span>
              ))}
            </div>
          )}

          <button
            onClick={() => onAddToCart(product)}
            className="mt-8 w-full rounded-xl bg-brand-600 py-3.5 text-lg font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.98] sm:w-auto sm:px-12"
          >
            Add to Cart
          </button>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold text-slate-800">Related Products</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── About Us Page ───
function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-slate-800 sm:text-4xl">About Poovi Shop</h2>
        <p className="mt-3 text-lg text-slate-500">Your trusted destination for premium products</p>
      </div>

      <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <section>
          <h3 className="mb-3 text-xl font-semibold text-slate-800">Who We Are</h3>
          <p className="leading-relaxed text-slate-600">
            Poovi Shop is a modern e-commerce platform offering carefully curated products across electronics,
            fashion, fitness, home decor, beauty, and sports. We believe in quality, affordability, and a
            seamless shopping experience for every customer.
          </p>
        </section>

        <section>
          <h3 className="mb-3 text-xl font-semibold text-slate-800">Our Mission</h3>
          <p className="leading-relaxed text-slate-600">
            To make premium products accessible to everyone in India with fast delivery, secure checkout,
            and exceptional customer service. Every product in our catalog is hand-picked for quality and value.
          </p>
        </section>

        <section>
          <h3 className="mb-3 text-xl font-semibold text-slate-800">Why Choose Us</h3>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { title: '10+ Premium Products', desc: 'Curated across 6 categories' },
              { title: 'Secure Checkout', desc: 'Safe and encrypted payments' },
              { title: 'Fast Delivery', desc: 'Quick shipping across India' },
              { title: 'Easy Returns', desc: 'Hassle-free return policy' },
            ].map((item) => (
              <li key={item.title} className="rounded-xl bg-brand-50 p-4">
                <p className="font-semibold text-brand-700">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-center">
          <p className="text-slate-500">Have questions? Reach us at</p>
          <a href="mailto:support@poovishop.com" className="mt-1 inline-block font-medium text-brand-600 hover:text-brand-700">
            support@poovishop.com
          </a>
        </section>
      </div>
    </div>
  )
}

// ─── Main App ───
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
  const navigate = useNavigate()

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${FALLBACK_PRODUCTS_URL}?v=${Date.now()}`)
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
    try {
      const res = await fetchWithTimeout(`${API_BASE}/products/`, 30000)
      if (res.ok) {
        const data = await res.json()
        setPRODUCTS(data)
        setFilteredProducts(data)
      }
    } catch { /* API unavailable */ }
  }

  useEffect(() => { loadProducts() }, [])

  useEffect(() => {
    if (!firebaseConfig?.apiKey) return
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

  const filterProducts = useCallback(
    debounce((term, products) => {
      if (!term.trim()) { setFilteredProducts(products); return }
      const lower = term.toLowerCase()
      setFilteredProducts(products.filter((p) =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.category?.toLowerCase().includes(lower)
      ))
    }, 300),
    []
  )

  useEffect(() => { filterProducts(searchTerm, PRODUCTS) }, [searchTerm, PRODUCTS, filterProducts])

  const generateRecommendations = (category) => {
    setRecommendedProducts(
      PRODUCTS.filter((p) => p.category === category && !cartItems.some((c) => c.id === p.id)).slice(0, 4)
    )
  }

  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    generateRecommendations(product.category)
    setOrderMessage('✓ Added to cart!')
    setTimeout(() => setOrderMessage(''), 2000)
  }

  const handleIncreaseQuantity = (productId) => {
    setCartItems((prev) =>
      prev.map((item) => item.id === productId ? { ...item, quantity: item.quantity + 1 } : item)
    )
  }

  const handleDecreaseQuantity = (productId) => {
    setCartItems((prev) =>
      prev
        .map((item) => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0)
    )
  }

  const handleRemoveFromCart = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId))
  }

  const handlePlaceOrder = async (formData, grandTotal) => {
    const newOrder = { ...formData, cartItems, grandTotal, createdAt: new Date().toISOString() }
    try {
      if (db && userId) {
        const ordersRef = collection(db, 'artifacts', appId, 'users', userId, 'orders')
        await addDoc(ordersRef, newOrder)
      }
      setCartItems([])
      setIsCheckout(false)
      setIsCartOpen(false)
      setOrderMessage('🎉 Order placed successfully! Thank you for shopping with us.')
      setTimeout(() => setOrderMessage(''), 5000)
      navigate('/')
    } catch (err) {
      console.error('Error placing order:', err)
      setOrderMessage('❌ Failed to place order. Please try again.')
      setTimeout(() => setOrderMessage(''), 5000)
    }
  }

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    if (value && window.location.pathname !== '/products') {
      navigate('/products')
    }
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen">
      <Header
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onCartToggle={() => setIsCartOpen((prev) => !prev)}
      />

      {orderMessage && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-[fadeIn_0.3s_ease-out] rounded-xl bg-white px-6 py-4 text-center font-medium text-slate-700 shadow-2xl ring-1 ring-slate-200">
          {orderMessage}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage products={PRODUCTS} onAddToCart={handleAddToCart} />} />
          <Route path="/products" element={
            <ProductsPage
              loading={loading}
              filteredProducts={filteredProducts}
              onAddToCart={handleAddToCart}
              onReload={loadProducts}
              recommendedProducts={recommendedProducts}
            />
          } />
          <Route path="/products/:id" element={
            <ProductDetailPage products={PRODUCTS} onAddToCart={handleAddToCart} />
          } />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      {isCartOpen && (
        <Cart
          cartItems={cartItems}
          onClose={() => setIsCartOpen(false)}
          onCheckout={() => { setIsCartOpen(false); setIsCheckout(true) }}
          onIncrease={handleIncreaseQuantity}
          onDecrease={handleDecreaseQuantity}
          onRemove={handleRemoveFromCart}
        />
      )}

      {isCheckout && (
        <CheckoutForm
          cartItems={cartItems}
          onPlaceOrder={handlePlaceOrder}
          onCancel={() => setIsCheckout(false)}
        />
      )}

      <footer className="mt-16 border-t border-slate-200/60 bg-white/60 py-8 text-center text-sm text-slate-400">
        <p>&copy; {new Date().getFullYear()} Poovi Shop. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  )
}

export default App
