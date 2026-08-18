'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast, Toaster } from 'sonner'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Leaf, Store, Truck,
  MapPin, Phone, User, ArrowLeft, Package, ClipboardList, Pencil, LogOut, CheckCircle2, ShieldCheck, RefreshCw,
} from 'lucide-react'

const money = (n) => `\u20b9${Number(n || 0).toLocaleString('en-IN')}`

// Resilient GET-JSON with timeout + retry + cache-busting. The preview/dev
// environment can intermittently stall in-app responses; retrying recovers it.
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 3000)
      const sep = url.includes('?') ? '&' : '?'
      const res = await fetch(url + sep + '_=' + Date.now() + Math.random(), { signal: ctrl.signal, cache: 'no-store' })
      clearTimeout(timer)
      if (res.ok) return await res.json()
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

/* ---------------- Product Card ---------------- */
function ProductCard({ product, qty, onAdd, onInc, onDec }) {
  return (
    <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative h-28 sm:h-36 bg-green-50 flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Leaf className="w-10 h-10 text-green-300" />
        )}
        {!product.in_stock && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-semibold text-red-500">Out of stock</span>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.unit}</p>
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <span className="text-base font-bold text-green-700">{money(product.price)}</span>
          {qty > 0 ? (
            <div className="flex items-center gap-1.5 bg-green-600 rounded-lg text-white">
              <button onClick={onDec} className="p-1.5"><Minus className="w-3.5 h-3.5" /></button>
              <span className="text-sm font-bold w-4 text-center">{qty}</span>
              <button onClick={onInc} className="p-1.5"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <Button
              size="sm"
              disabled={!product.in_stock}
              onClick={onAdd}
              className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-0.5" /> Add
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Store View ---------------- */
function StoreView({ onOpenAdmin }) {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(null)

  const [form, setForm] = useState({ customer_name: '', phone: '', fulfillment: 'delivery', address: '' })

  // load cart from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fk_cart')
      if (saved) setCart(JSON.parse(saved))
    } catch (_) {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('fk_cart', JSON.stringify(cart)) } catch (_) {}
  }, [cart])

  // initial load: seed (background) + config + categories
  useEffect(() => {
    // fire seed via beacon so its response can't stall anything
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/seed')
      else fetch('/api/seed', { method: 'POST', keepalive: true }).catch(() => {})
    } catch (_) { fetch('/api/seed', { method: 'POST' }).catch(() => {}) }
    ;(async () => {
      const cfg = await getJSON('/api/config')
      if (cfg) setWhatsapp(cfg?.whatsapp || '')
      const c = await getJSON('/api/categories')
      if (Array.isArray(c)) setCategories(c)
    })()
  }, [])

  // load products on filter change (debounced search)
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeCat !== 'all') params.set('category', activeCat)
      if (search.trim()) params.set('q', search.trim())
      const data = await getJSON(`/api/products?${params.toString()}`)
      setProducts(Array.isArray(data) ? data : [])
      setLoading(false)
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [activeCat, search])

  // Safety: when no Radix modal (Sheet/Dialog) is open, ensure body is interactive.
  // (Radix can leave body pointer-events:none when a Sheet closes as a Dialog opens.)
  useEffect(() => {
    if (!cartOpen && !checkoutOpen) {
      const t = setTimeout(() => { document.body.style.pointerEvents = '' }, 0)
      return () => clearTimeout(t)
    }
  }, [cartOpen, checkoutOpen])


  const cartItems = useMemo(() => Object.values(cart), [cart])
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0)

  const addToCart = (p) => setCart((c) => ({ ...c, [p.id]: { id: p.id, name: p.name, price: p.price, unit: p.unit, qty: (c[p.id]?.qty || 0) + 1 } }))
  const inc = (id) => setCart((c) => ({ ...c, [id]: { ...c[id], qty: c[id].qty + 1 } }))
  const dec = (id) => setCart((c) => {
    const q = (c[id]?.qty || 0) - 1
    const next = { ...c }
    if (q <= 0) delete next[id]; else next[id] = { ...c[id], qty: q }
    return next
  })
  const removeItem = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n })

  const placeOrder = async () => {
    if (!form.customer_name.trim() || !form.phone.trim()) { toast.error('Please enter name and phone number'); return }
    if (form.fulfillment === 'delivery' && !form.address.trim()) { toast.error('Please enter delivery address'); return }
    if (cartItems.length === 0) { toast.error('Your cart is empty'); return }
    setPlacing(true)
    try {
      const ref = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))
      const orderId = ref.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
      const payload = {
        ref: orderId,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        fulfillment: form.fulfillment,
        address: form.fulfillment === 'delivery' ? form.address.trim() : null,
        items: cartItems,
        total: cartTotal,
      }

      // Save order to the backend fire-and-forget (sendBeacon), so the UX never
      // waits on the network response. The server still receives & stores it.
      let sent = false
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
          sent = navigator.sendBeacon('/api/orders', blob)
        }
      } catch (_) {}
      if (!sent) {
        fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {})
      }

      // Build WhatsApp message
      const lines = []
      lines.push('*New Order - Sharma FreshKart*')
      lines.push(`Order ID: ${orderId}`)
      lines.push(`Name: ${payload.customer_name}`)
      lines.push(`Phone: ${payload.phone}`)
      lines.push(`Type: ${payload.fulfillment === 'pickup' ? 'Pick Up at Store' : 'Home Delivery'}`)
      if (payload.address) lines.push(`Address: ${payload.address}`)
      lines.push('')
      lines.push('*Items:*')
      cartItems.forEach((i) => lines.push(`- ${i.qty} x ${i.name} (${i.unit}) = ${money(i.qty * i.price)}`))
      lines.push('')
      lines.push(`*Total: ${money(cartTotal)}*`)
      lines.push('Payment: Cash on Delivery')
      const msg = encodeURIComponent(lines.join('\n'))
      const num = (whatsapp || '').replace(/[^0-9]/g, '')
      const waUrl = `https://wa.me/${num}?text=${msg}`

      setCart({})
      setCheckoutOpen(false)
      setCartOpen(false)
      // open the success dialog after the checkout dialog has fully closed
      setTimeout(() => setSuccess({ id: orderId, waUrl }), 280)
      // try to open WhatsApp (fallback link is inside the success dialog)
      window.open(waUrl, '_blank')
    } catch (e) {
      toast.error(e.message || 'Something went wrong')
    }
    setPlacing(false)
  }

  return (
    <div className="min-h-screen bg-green-50/40 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-green-700 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="bg-white rounded-lg p-1"><Leaf className="w-5 h-5 text-green-600" /></div>
            <div className="flex-1 leading-none">
              <h1 className="text-lg font-extrabold tracking-tight">Sharma <span className="text-orange-300">FreshKart</span></h1>
              <p className="text-[10px] text-green-100">Fresh groceries at your door</p>
            </div>
            <button onClick={() => setCartOpen(true)} className="relative bg-orange-500 hover:bg-orange-600 rounded-lg p-2">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-white text-green-700 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>
              )}
            </button>
          </div>
          {/* Search */}
          <div className="mt-2.5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for vegetables, fruits, milk..."
              className="pl-9 h-10 bg-white text-black rounded-xl border-0"
            />
          </div>
        </div>
      </header>

      {/* Category chips */}
      <div className="max-w-3xl mx-auto px-3 py-3 sticky top-[104px] z-20 bg-green-50/40">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveCat('all')}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium border ${activeCat === 'all' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-800 border-green-200'}`}
          >All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.slug)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium border ${activeCat === c.slug ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-800 border-green-200'}`}
            >{c.name}</button>
          ))}
        </div>
      </div>

      {/* Products */}
      <main className="max-w-3xl mx-auto px-3">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-white rounded-xl border border-green-100 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={cart[p.id]?.qty || 0}
                onAdd={() => addToCart(p)}
                onInc={() => inc(p.id)}
                onDec={() => dec(p.id)}
              />
            ))}
          </div>
        )}
        <div className="text-center mt-10 mb-4">
          <button onClick={onOpenAdmin} className="text-xs text-green-700/70 inline-flex items-center gap-1 hover:underline">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin Login
          </button>
        </div>
      </main>

      {/* Floating cart bar */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3">
          <button
            onClick={() => setCartOpen(true)}
            className="max-w-3xl mx-auto w-full bg-green-700 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg"
          >
            <span className="font-medium">{cartCount} item{cartCount > 1 ? 's' : ''} · {money(cartTotal)}</span>
            <span className="font-bold flex items-center gap-1">View Cart <ShoppingCart className="w-4 h-4" /></span>
          </button>
        </div>
      )}

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-green-600" /> Your Cart</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Cart is empty</p>
              </div>
            ) : cartItems.map((i) => (
              <div key={i.id} className="flex items-center gap-3 bg-green-50/60 rounded-lg p-2.5">
                <div className="flex-1">
                  <p className="text-sm font-semibold leading-tight">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.unit} · {money(i.price)}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-green-600 rounded-lg text-white">
                  <button onClick={() => dec(i.id)} className="p-1.5"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="text-sm font-bold w-4 text-center">{i.qty}</span>
                  <button onClick={() => inc(i.id)} className="p-1.5"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-sm font-bold w-14 text-right">{money(i.qty * i.price)}</span>
                <button onClick={() => removeItem(i.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {cartItems.length > 0 && (
            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span><span className="text-green-700">{money(cartTotal)}</span>
              </div>
              <Button onClick={() => { setCartOpen(false); setTimeout(() => setCheckoutOpen(true), 280) }} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white text-base font-bold">
                Proceed to Checkout
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Checkout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="flex items-center gap-1.5 mb-1"><User className="w-3.5 h-3.5" /> Full Name</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1"><Phone className="w-3.5 h-3.5" /> Phone Number</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile number" inputMode="numeric" />
            </div>
            <div>
              <Label className="mb-1.5 block">Order Type</Label>
              <RadioGroup value={form.fulfillment} onValueChange={(v) => setForm({ ...form, fulfillment: v })} className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 border rounded-lg p-2.5 cursor-pointer ${form.fulfillment === 'delivery' ? 'border-green-600 bg-green-50' : ''}`}>
                  <RadioGroupItem value="delivery" /> <Truck className="w-4 h-4 text-green-600" /> <span className="text-sm">Delivery</span>
                </label>
                <label className={`flex items-center gap-2 border rounded-lg p-2.5 cursor-pointer ${form.fulfillment === 'pickup' ? 'border-green-600 bg-green-50' : ''}`}>
                  <RadioGroupItem value="pickup" /> <Store className="w-4 h-4 text-green-600" /> <span className="text-sm">Pickup</span>
                </label>
              </RadioGroup>
            </div>
            {form.fulfillment === 'delivery' && (
              <div>
                <Label className="flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5" /> Delivery Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House no, street, area, landmark" rows={3} />
              </div>
            )}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Payment: Cash on Delivery
            </div>
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Total</span><span className="text-green-700">{money(cartTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={placeOrder} disabled={placing} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-bold">
              {placing ? 'Placing order...' : 'Place Order & Send on WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success overlay (plain fixed div to avoid Radix modal stacking) */}
      {success && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setSuccess(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full text-center p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-100 rounded-full p-3"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
              <h3 className="text-xl font-bold">Order Placed!</h3>
              <p className="text-sm text-muted-foreground">Order ID <b>#{success?.id}</b>. Please confirm your order on WhatsApp so we can process it.</p>
              <a href={success?.waUrl} target="_blank" rel="noreferrer" className="w-full">
                <Button className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-bold">Open WhatsApp</Button>
              </a>
              <Button variant="ghost" onClick={() => setSuccess(null)} className="w-full">Continue Shopping</Button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-center" richColors />
    </div>
  )
}

/* ---------------- Admin View ---------------- */
const CAT_OPTIONS = [
  { slug: 'vegetables', name: 'Vegetables' },
  { slug: 'fruits', name: 'Fruits' },
  { slug: 'grocery', name: 'Grocery' },
  { slug: 'dairy', name: 'Dairy' },
  { slug: 'daily-needs', name: 'Daily Needs' },
  { slug: 'household', name: 'House Hold Items' },
  { slug: 'apparels', name: 'Apparels' },
  { slug: 'items-10', name: 'Items @\u20b910/-' },
]

function AdminView({ onBack }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const emptyForm = { category_slug: 'vegetables', name: '', price: '', unit: '1 kg', image_url: '', in_stock: true }
  const [pForm, setPForm] = useState(emptyForm)

  const login = async () => {
    // GET (with retry) so the response is reliably delivered
    const data = await getJSON('/api/admin/login?password=' + encodeURIComponent(password))
    if (data && data.success) { setAuthed(true); loadAll() }
    else toast.error('Wrong password')
  }

  const loadAll = async () => {
    const [p, o] = await Promise.all([
      getJSON('/api/products?admin=1'),
      getJSON('/api/orders'),
    ])
    if (Array.isArray(p)) setProducts(p)
    if (Array.isArray(o)) setOrders(o)
  }

  const openNew = () => { setEditing(null); setPForm(emptyForm); setDialogOpen(true) }
  const openEdit = (p) => {
    setEditing(p)
    setPForm({ category_slug: p.category_slug, name: p.name, price: p.price, unit: p.unit || '', image_url: p.image_url || '', in_stock: p.in_stock })
    setDialogOpen(true)
  }

  // Mutations are fire-and-forget (request reaches server; response can stall in
  // some proxies). We optimistically update the UI and re-fetch shortly after.
  const saveProduct = async () => {
    if (!pForm.name.trim()) { toast.error('Name required'); return }
    const method = editing ? 'PUT' : 'POST'
    const path = editing ? `/api/products/${editing.id}` : '/api/products'
    fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pForm), keepalive: true }).catch(() => {})
    toast.success(editing ? 'Product updated' : 'Product added')
    setDialogOpen(false)
    setTimeout(loadAll, 1000)
  }

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return
    fetch(`/api/products/${id}`, { method: 'DELETE', keepalive: true }).catch(() => {})
    setProducts((prev) => prev.filter((p) => p.id !== id))
    toast.success('Deleted')
    setTimeout(loadAll, 1000)
  }

  const updateOrderStatus = async (id, status) => {
    fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }), keepalive: true }).catch(() => {})
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    setTimeout(loadAll, 1000)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="bg-green-600 rounded-xl p-2.5 inline-flex mb-2"><ShieldCheck className="w-6 h-6 text-white" /></div>
            <h2 className="text-xl font-bold">Admin Login</h2>
            <p className="text-sm text-muted-foreground">Sharma FreshKart</p>
          </div>
          <div>
            <Label className="mb-1 block">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} placeholder="Enter admin password" />
          </div>
          <Button onClick={login} className="w-full bg-green-600 hover:bg-green-700 text-white">Login</Button>
          <Button variant="ghost" onClick={onBack} className="w-full"><ArrowLeft className="w-4 h-4 mr-1" /> Back to store</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-green-700 text-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5" />
            <span className="font-bold">FreshKart Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={loadAll}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
            <Button size="sm" variant="secondary" onClick={onBack}><LogOut className="w-4 h-4 mr-1" /> Exit</Button>
          </div>
        </div>
      </header>
      <div className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="products">
          <TabsList className="grid grid-cols-2 w-full max-w-xs mb-4">
            <TabsTrigger value="products"><Package className="w-4 h-4 mr-1" /> Products</TabsTrigger>
            <TabsTrigger value="orders"><ClipboardList className="w-4 h-4 mr-1" /> Orders</TabsTrigger>
          </TabsList>

          {/* Products */}
          <TabsContent value="products">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">Products ({products.length})</h3>
              <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="bg-white rounded-lg border p-2.5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-green-50 overflow-hidden flex items-center justify-center shrink-0">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Leaf className="w-5 h-5 text-green-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.unit} · {CAT_OPTIONS.find((c) => c.slug === p.category_slug)?.name || p.category_slug}</p>
                  </div>
                  <span className="font-bold text-green-700">{money(p.price)}</span>
                  <Badge variant={p.in_stock ? 'default' : 'destructive'} className={p.in_stock ? 'bg-green-100 text-green-700' : ''}>{p.in_stock ? 'In stock' : 'Out'}</Badge>
                  <button onClick={() => openEdit(p)} className="text-blue-500 p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteProduct(p.id)} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders">
            <h3 className="font-bold text-lg mb-3">Orders ({orders.length})</h3>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-muted-foreground text-center py-10">No orders yet</p>}
              {orders.map((o) => (
                <div key={o.id} className="bg-white rounded-lg border p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">#{o.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm">{o.customer_name} · {o.phone}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{money(o.total)}</p>
                      <Badge className="bg-orange-100 text-orange-700">{o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</Badge>
                    </div>
                  </div>
                  {o.address && <p className="text-xs mt-1 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {o.address}</p>}
                  <div className="mt-2 border-t pt-2 text-sm space-y-0.5">
                    {(o.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between"><span>{it.qty} x {it.name}</span><span>{money(it.qty * it.price)}</span></div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Label className="text-xs">Status:</Label>
                    <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="out-for-delivery">Out for delivery</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">Name</Label>
              <Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="Product name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Price (\u20b9)</Label>
                <Input type="number" value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Unit</Label>
                <Input value={pForm.unit} onChange={(e) => setPForm({ ...pForm, unit: e.target.value })} placeholder="1 kg" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Category</Label>
              <Select value={pForm.category_slug} onValueChange={(v) => setPForm({ ...pForm, category_slug: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAT_OPTIONS.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Image URL (optional)</Label>
              <Input value={pForm.image_url} onChange={(e) => setPForm({ ...pForm, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pForm.in_stock} onChange={(e) => setPForm({ ...pForm, in_stock: e.target.checked })} /> In stock
            </label>
          </div>
          <DialogFooter>
            <Button onClick={saveProduct} className="w-full bg-green-600 hover:bg-green-700 text-white">{editing ? 'Update' : 'Add Product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster position="top-center" richColors />
    </div>
  )
}

/* ---------------- Root ---------------- */
function App() {
  const [view, setView] = useState('store')
  return view === 'admin'
    ? <AdminView onBack={() => setView('store')} />
    : <StoreView onOpenAdmin={() => setView('admin')} />
}

export default App
