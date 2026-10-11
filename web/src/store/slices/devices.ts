import { createSlice } from '@reduxjs/toolkit';

interface DevicesState {
  micOn: boolean;
  showSubtitle: boolean;
}

const initialState: DevicesState = {
  micOn: true,
  showSubtitle: true,
};

export const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setMicOn(state, action: { payload: boolean }) {
      state.micOn = action.payload;
    },
    toggleSubtitle(state) {
      state.showSubtitle = !state.showSubtitle;
    },
  },
});

export const { setMicOn, toggleSubtitle } = devicesSlice.actions;

export default devicesSlice.reducer;
