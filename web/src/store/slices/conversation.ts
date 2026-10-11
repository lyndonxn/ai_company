import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AgentPhase = 'connecting' | 'listening' | 'thinking' | 'speaking';

export interface Msg {
  speaker: 'user' | 'agent';
  text: string;
  final: boolean;
  interrupted?: boolean;
}

interface ConversationState {
  messages: Msg[];
  phase: AgentPhase;
  /** 0..1 实时电平,驱动头像光球 */
  level: number;
  error?: string;
}

const initialState: ConversationState = {
  messages: [],
  phase: 'connecting',
  level: 0,
};

export const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    setPhase(state, action: PayloadAction<AgentPhase>) {
      state.phase = action.payload;
    },
    /** 字幕合并:同一说话人的未定稿分片原位替换;定稿落定 */
    appendSubtitle(
      state,
      action: PayloadAction<{ speaker: Msg['speaker']; text: string; final: boolean; interrupted?: boolean }>,
    ) {
      const { speaker, text, final, interrupted } = action.payload;
      const last = state.messages[state.messages.length - 1];
      const continuing = last && last.speaker === speaker && !last.final;
      if (continuing) {
        last.text = text;
        last.final = final;
        last.interrupted = interrupted;
        return;
      }
      state.messages.push({ speaker, text, final, interrupted });
    },
    clearMessages(state) {
      state.messages = [];
      state.level = 0;
      state.error = undefined;
    },
    setLevel(state, action: PayloadAction<number>) {
      state.level = action.payload;
    },
    setError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
  },
});

export const { setPhase, appendSubtitle, clearMessages, setLevel, setError } =
  conversationSlice.actions;

export default conversationSlice.reducer;
