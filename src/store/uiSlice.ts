import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface UiState {
  toasts: ToastItem[];
  language: 'en' | 'bn';
  announcementDismissed: boolean;
}

const initialState: UiState = {
  toasts: [],
  language: 'en',
  announcementDismissed: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    pushToast(state, action: PayloadAction<Omit<ToastItem, 'id'>>) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.toasts.push({ id, ...action.payload });
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setLanguage(state, action: PayloadAction<'en' | 'bn'>) {
      state.language = action.payload;
    },
    dismissAnnouncement(state) {
      state.announcementDismissed = true;
    },
  },
});

export const { pushToast, dismissToast, setLanguage, dismissAnnouncement } = uiSlice.actions;
export default uiSlice.reducer;
