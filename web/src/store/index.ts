import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from './slices/session';
import conversationReducer from './slices/conversation';
import devicesReducer from './slices/devices';

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    conversation: conversationReducer,
    devices: devicesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
