import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiRequest } from '../lib/api';

export interface CartItemDto {
  offerId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productImage: string;
  variantSku: string;
  variantLabel: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  stock: number;
  maxPurchaseQty: number;
  deliveryEstimateDays: string;
}

export interface CartQuoteDto {
  itemsSubtotal: number;
  shippingTotal: number;
  couponDiscountTotal: number;
  grandTotal: number;
  sellerGroups: Array<{
    storeId: string;
    storeName: string;
    subtotal: number;
    shippingFee: number;
    couponDiscountShare: number;
    items: Array<{ offerId: string; lineTotal: number }>;
  }>;
}

interface CartState {
  items: CartItemDto[];
  quote: CartQuoteDto;
  drawerOpen: boolean;
  loading: boolean;
}

const GUEST_CART_STORAGE_KEY = 'novara_guest_cart_items';

function loadGuestOfferRefs(): Array<{ offerId: string; quantity: number }> {
  try {
    const raw = sessionStorage.getItem(GUEST_CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGuestOfferRefs(items: Array<{ offerId: string; quantity: number }>) {
  try {
    sessionStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

const emptyQuote: CartQuoteDto = {
  itemsSubtotal: 0,
  shippingTotal: 0,
  couponDiscountTotal: 0,
  grandTotal: 0,
  sellerGroups: [],
};

const initialState: CartState = {
  items: [],
  quote: emptyQuote,
  drawerOpen: false,
  loading: false,
};

export const hydrateCart = createAsyncThunk('cart/hydrate', async (_, { getState }) => {
  const state = getState() as { auth: { user: any } };
  if (state.auth.user) {
    const guestRefs = loadGuestOfferRefs();
    if (guestRefs.length > 0) {
      saveGuestOfferRefs([]);
      return apiRequest('/api/cart/merge', {
        method: 'POST',
        body: JSON.stringify({ items: guestRefs }),
      });
    }
    return apiRequest('/api/cart');
  }
  const guestRefs = loadGuestOfferRefs();
  if (guestRefs.length === 0) return { items: [], quote: emptyQuote };
  return apiRequest('/api/cart/quote', {
    method: 'POST',
    body: JSON.stringify({ items: guestRefs }),
  });
});

export const addItemToCart = createAsyncThunk(
  'cart/addItem',
  async (payload: { offerId: string; quantity?: number; openDrawer?: boolean }, { getState }) => {
    const state = getState() as { auth: { user: any } };
    const qty = payload.quantity || 1;
    if (state.auth.user) {
      return apiRequest('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ offerId: payload.offerId, quantity: qty }),
      });
    }
    const guestRefs = loadGuestOfferRefs();
    const existing = guestRefs.find((i) => i.offerId === payload.offerId);
    if (existing) existing.quantity += qty;
    else guestRefs.push({ offerId: payload.offerId, quantity: qty });
    saveGuestOfferRefs(guestRefs);
    return apiRequest('/api/cart/quote', {
      method: 'POST',
      body: JSON.stringify({ items: guestRefs }),
    });
  }
);

export const updateCartItemQty = createAsyncThunk(
  'cart/updateQty',
  async (payload: { offerId: string; quantity: number }, { getState }) => {
    const state = getState() as { auth: { user: any } };
    if (state.auth.user) {
      return apiRequest(`/api/cart/items/${payload.offerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: payload.quantity }),
      });
    }
    let guestRefs = loadGuestOfferRefs();
    if (payload.quantity <= 0) {
      guestRefs = guestRefs.filter((i) => i.offerId !== payload.offerId);
    } else {
      const target = guestRefs.find((i) => i.offerId === payload.offerId);
      if (target) target.quantity = payload.quantity;
    }
    saveGuestOfferRefs(guestRefs);
    return apiRequest('/api/cart/quote', {
      method: 'POST',
      body: JSON.stringify({ items: guestRefs }),
    });
  }
);

export const removeCartItem = createAsyncThunk(
  'cart/removeItem',
  async (offerId: string, { getState }) => {
    const state = getState() as { auth: { user: any } };
    if (state.auth.user) {
      return apiRequest(`/api/cart/items/${offerId}`, { method: 'DELETE' });
    }
    const guestRefs = loadGuestOfferRefs().filter((i) => i.offerId !== offerId);
    saveGuestOfferRefs(guestRefs);
    return apiRequest('/api/cart/quote', {
      method: 'POST',
      body: JSON.stringify({ items: guestRefs }),
    });
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartDrawerOpen(state, action: PayloadAction<boolean>) {
      state.drawerOpen = action.payload;
    },
    clearCartState(state) {
      state.items = [];
      state.quote = emptyQuote;
    },
  },
  extraReducers: (builder) => {
    const applyResponse = (state: CartState, action: any) => {
      state.loading = false;
      state.items = action.payload?.items || [];
      state.quote = action.payload?.quote || emptyQuote;
    };
    builder
      .addCase(hydrateCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(hydrateCart.fulfilled, applyResponse)
      .addCase(hydrateCart.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addItemToCart.fulfilled, (state, action) => {
        applyResponse(state, action);
        if (action.meta.arg.openDrawer !== false) {
          state.drawerOpen = true;
        }
      })
      .addCase(updateCartItemQty.fulfilled, applyResponse)
      .addCase(removeCartItem.fulfilled, applyResponse);
  },
});

export const { setCartDrawerOpen, clearCartState } = cartSlice.actions;
export default cartSlice.reducer;
