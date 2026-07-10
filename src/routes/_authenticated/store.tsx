import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/store")({
  component: Store,
});

interface Product {
  id: string; name: string; description: string | null; price: number;
  category: string; image_url: string | null; featured: boolean;
}

interface CartItem { id: string; name: string; price: number; qty: number }

const CART_KEY = "treckweb-cart";

function Store() {
  const { user } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState<"idle" | "processing" | "done">("idle");

  useEffect(() => {
    const saved = localStorage.getItem(CART_KEY);
    if (saved) setCart(JSON.parse(saved));
  }, []);
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("featured", { ascending: false });
      return (data ?? []) as Product[];
    },
  });

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) =>
    (category === "all" || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const exists = prev.find((c) => c.id === p.id);
      if (exists) return prev.map((c) => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
    toast.success(`${p.name} added to cart`);
  };

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return setCart((p) => p.filter((c) => c.id !== id));
    setCart((p) => p.map((c) => c.id === id ? { ...c, qty } : c));
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const checkout = async () => {
    if (!cart.length) return;
    setCheckoutState("processing");
    await new Promise((r) => setTimeout(r, 1200));
    const { error } = await supabase.from("orders").insert({
      user_id: user.id, items: cart as unknown as never, total, status: "confirmed",
    });
    if (error) { toast.error(error.message); setCheckoutState("idle"); return; }
    setCheckoutState("done");
    setCart([]);
    setTimeout(() => { setCheckoutState("idle"); setCartOpen(false); }, 3000);
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store</h1>
          <p className="text-sm text-muted-foreground">Curated products from TreckWeb.</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <ShoppingCart className="h-4 w-4" />
          Cart
          {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-5 w-5 grid place-items-center font-bold">{cart.reduce((s, c) => s + c.qty, 0)}</span>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background/40 text-sm outline-none focus:border-primary" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`text-xs px-3 py-2 rounded-full whitespace-nowrap transition ${
                category === c ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"
              }`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="glass rounded-2xl overflow-hidden hover:shadow-[var(--shadow-glow)] transition group">
            <div className="aspect-video bg-gradient-to-br from-primary/20 via-primary-glow/10 to-transparent grid place-items-center text-primary/40 text-4xl font-bold">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : p.name[0]}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                </div>
                {p.featured && <span className="text-[10px] font-bold uppercase text-primary shrink-0">★ Top</span>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold">${Number(p.price).toFixed(2)}</span>
                <button onClick={() => addToCart(p)} className="text-xs rounded-full bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 shadow-[var(--shadow-glow)]">Add</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-background border-l border-border z-50 flex flex-col">
              <header className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold">Your cart</h2>
                <button onClick={() => setCartOpen(false)} className="p-2 rounded-lg hover:bg-accent"><X className="h-4 w-4" /></button>
              </header>

              {checkoutState === "done" ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-16 w-16 rounded-full bg-success/20 text-success grid place-items-center">
                    <Check className="h-8 w-8" />
                  </motion.div>
                  <h3 className="mt-4 text-xl font-bold">Order confirmed!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Thanks for your purchase. You'll receive a confirmation shortly.</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Your cart is empty.</p>}
                    {cart.map((c) => (
                      <div key={c.id} className="glass rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">${c.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQty(c.id, c.qty - 1)} className="p-1 rounded-md hover:bg-accent"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-sm font-medium">{c.qty}</span>
                          <button onClick={() => setQty(c.id, c.qty + 1)} className="p-1 rounded-md hover:bg-accent"><Plus className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border p-4">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">${total.toFixed(2)}</span>
                    </div>
                    <button onClick={checkout} disabled={!cart.length || checkoutState === "processing"}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[var(--shadow-glow)]">
                      {checkoutState === "processing" ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</> : "Fake checkout"}
                    </button>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">Demo checkout — Stripe integration coming soon.</p>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
