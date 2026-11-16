import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiRequest, clearAuthToken, setAuthToken } from '../lib/api';

export interface UserDto {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  permissions: string[];
  emailVerified: boolean;
  addresses: any[];
  wishlistCount: number;
}

export interface AuthState {
  user: UserDto | null;
  sellerStore: { _id: string; name: string; slug: string; status: string } | null;
  sellerApplication: { _id: string; status: string; storeName: string; reviewNotes?: string } | null;
  unreadNotifications: number;
  loading: boolean;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  sellerStore: null,
  sellerApplication: null,
  unreadNotifications: 0,
  loading: false,
  initialized: false,
};

export const fetchCurrentUser = createAsyncThunk('auth/me', async () => {
  try {
    const res = await apiRequest('/api/auth/session');
    if (res?.user) {
      if (res.token) setAuthToken(res.token);
      return res;
    }
    clearAuthToken();
    return null;
  } catch {
    return null;
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthSession(
      state,
      action: PayloadAction<{
        user: UserDto;
        sellerStore?: AuthState['sellerStore'];
        sellerApplication?: AuthState['sellerApplication'];
      }>
    ) {
      state.user = action.payload.user;
      if (action.payload.sellerStore !== undefined) state.sellerStore = action.payload.sellerStore;
      if (action.payload.sellerApplication !== undefined) {
        state.sellerApplication = action.payload.sellerApplication;
      }
      state.initialized = true;
    },
    setWishlistCount(state, action: PayloadAction<number>) {
      if (state.user) state.user.wishlistCount = action.payload;
    },
    setUnreadNotifications(state, action: PayloadAction<number>) {
      state.unreadNotifications = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        if (action.payload?.user) {
          state.user = action.payload.user;
          state.sellerStore = action.payload.sellerStore || null;
          state.sellerApplication = action.payload.sellerApplication || null;
          state.unreadNotifications = action.payload.unreadNotifications || 0;
        } else {
          state.user = null;
          state.sellerStore = null;
          state.sellerApplication = null;
        }
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
        state.initialized = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.sellerStore = null;
        state.sellerApplication = null;
        state.unreadNotifications = 0;
      });
  },
});

export const { setAuthSession, setWishlistCount, setUnreadNotifications } = authSlice.actions;
export default authSlice.reducer;
