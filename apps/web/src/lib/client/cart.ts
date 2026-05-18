type CartItem = {
  productId: string;
  name: string;
  coverUrl: string | null;
  priceCents: number;
  originalPriceCents: number | null;
  quantity: number;
};

const STORAGE_KEY = 'client_cart_v1';

function safeParseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: CartItem[] = [];
    for (const it of parsed) {
      if (!it || typeof it !== 'object') continue;
      const r = it as Record<string, unknown>;
      const productId = typeof r.productId === 'string' ? r.productId : '';
      const name = typeof r.name === 'string' ? r.name : '';
      const coverUrl =
        typeof r.coverUrl === 'string'
          ? r.coverUrl
          : r.coverUrl === null
            ? null
            : null;
      const priceCents =
        typeof r.priceCents === 'number' ? Math.trunc(r.priceCents) : NaN;
      const originalPriceCents =
        typeof r.originalPriceCents === 'number'
          ? Math.trunc(r.originalPriceCents)
          : r.originalPriceCents === null
            ? null
            : null;
      const quantity =
        typeof r.quantity === 'number' ? Math.trunc(r.quantity) : NaN;

      if (!productId || !name) continue;
      if (!Number.isFinite(priceCents) || priceCents < 0) continue;
      if (!Number.isFinite(quantity) || quantity < 1) continue;

      items.push({
        productId,
        name,
        coverUrl,
        priceCents,
        originalPriceCents,
        quantity,
      });
    }
    return items;
  } catch {
    return [];
  }
}

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  return safeParseCart(window.localStorage.getItem(STORAGE_KEY));
}

function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('client_cart_updated'));
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCartSnapshot(): CartItem[] {
  return readCart();
}

export function getCartCountSnapshot(): number {
  const items = readCart();
  return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
}

export function addToCart(input: Omit<CartItem, 'quantity'>, quantity = 1) {
  const qty = Math.max(1, Math.min(99, Math.trunc(quantity || 1)));
  const items = readCart();
  const idx = items.findIndex((it) => it.productId === input.productId);
  if (idx >= 0) {
    const next = [...items];
    const prev = next[idx]!;
    next[idx] = {
      ...prev,
      name: input.name,
      coverUrl: input.coverUrl,
      priceCents: input.priceCents,
      originalPriceCents: input.originalPriceCents,
      quantity: Math.min(99, prev.quantity + qty),
    };
    writeCart(next);
  } else {
    writeCart([
      ...items,
      {
        ...input,
        quantity: qty,
      },
    ]);
  }
  emit();
}

export function setCartQuantity(productId: string, quantity: number) {
  const qty = Math.max(1, Math.min(99, Math.trunc(quantity || 1)));
  const items = readCart();
  const idx = items.findIndex((it) => it.productId === productId);
  if (idx < 0) return;
  const next = [...items];
  next[idx] = { ...next[idx]!, quantity: qty };
  writeCart(next);
  emit();
}

export function removeFromCart(productId: string) {
  const items = readCart();
  const next = items.filter((it) => it.productId !== productId);
  writeCart(next);
  emit();
}

export function clearCart() {
  writeCart([]);
  emit();
}

export function setupCartListenersOnce() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__client_cart_listener_installed) return;
  w.__client_cart_listener_installed = true;
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) emit();
  });
  window.addEventListener('client_cart_updated', () => emit());
}

export type { CartItem };
