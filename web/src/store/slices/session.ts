import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Scene, SessionInfo } from '@/types';

export interface ActiveSession {
  session: SessionInfo;
  scene: Scene;
  startedAt: number;
}

interface SessionState {
  scenes: Scene[];
  scenesStatus: 'idle' | 'loading' | 'ready' | 'error';
  scenesError?: string;
  active: ActiveSession | null;
  /** 从首页带进房间的首轮问题(快捷问题) */
  pendingQuestion: string | null;
}

const initialState: SessionState = {
  scenes: [],
  scenesStatus: 'idle',
  active: null,
  pendingQuestion: null,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    scenesLoading(state) {
      state.scenesStatus = 'loading';
      state.scenesError = undefined;
    },
    scenesReady(state, action: PayloadAction<Scene[]>) {
      state.scenes = action.payload;
      state.scenesStatus = 'ready';
    },
    scenesError(state, action: PayloadAction<string>) {
      state.scenesStatus = 'error';
      state.scenesError = action.payload;
    },
    setActive(state, action: PayloadAction<ActiveSession>) {
      state.active = action.payload;
    },
    clearActive(state) {
      state.active = null;
    },
    setPendingQuestion(state, action: PayloadAction<string | null>) {
      state.pendingQuestion = action.payload;
    },
  },
});

export const {
  scenesLoading,
  scenesReady,
  scenesError,
  setActive,
  clearActive,
  setPendingQuestion,
} = sessionSlice.actions;

export default sessionSlice.reducer;
