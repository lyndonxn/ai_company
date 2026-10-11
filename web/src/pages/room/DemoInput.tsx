import { useRef, useState } from 'react';
import { SendIcon } from '@/components/icons';
import type { AgentPhase } from '@/store/slices/conversation';
import styles from './Room.module.css';

interface DemoInputProps {
  phase: AgentPhase;
  disabled: boolean;
  onSend: (text: string) => void;
}

const PLACEHOLDER: Record<AgentPhase, string> = {
  connecting: '正在连接…',
  listening: '输入文字,模拟开口说话(Enter 发送)',
  thinking: '对方思考中…',
  speaking: '对方正在说话,开麦可打断',
};

export function DemoInput({ phase, disabled, onSend }: DemoInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const text = value.trim();
    if (!text || disabled || phase !== 'listening') return;
    onSend(text);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.demoInput}>
      <textarea
        ref={inputRef}
        className={styles.demoTextarea}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={PLACEHOLDER[phase]}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        aria-label="演示语音输入"
      />
      <button
        className={styles.demoSend}
        onClick={send}
        disabled={disabled || phase !== 'listening' || !value.trim()}
        aria-label="发送"
      >
        <SendIcon />
      </button>
    </div>
  );
}
