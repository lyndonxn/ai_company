import { useEffect, useRef } from 'react';
import type { Msg } from '@/store/slices/conversation';
import styles from './Room.module.css';

interface TranscriptProps {
  messages: Msg[];
  accent: string;
  agentAvatar: string;
  agentName: string;
  streaming: boolean;
}

export function Transcript({ messages, accent, agentAvatar, agentName, streaming }: TranscriptProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  return (
    <div className={styles.transcript} ref={boxRef} aria-live="polite">
      {messages.length === 0 && (
        <div className={styles.transcriptEmpty}>
          <span className={styles.emptySpin} aria-hidden />
          AI 准备中,请稍候
        </div>
      )}
      {messages.map((msg, i) => {
        const isAgent = msg.speaker === 'agent';
        const isLast = i === messages.length - 1;
        const typing = isLast && streaming && !msg.final;
        return (
          <div key={i} className={`${styles.line} ${isAgent ? styles.lineAgent : styles.lineUser}`}>
            <div className={styles.lineMeta}>
              {isAgent ? (
                <span className={styles.miniOrb} style={{ ['--accent' as string]: accent }} aria-hidden>
                  {agentAvatar}
                </span>
              ) : (
                <span className={styles.miniUser} aria-hidden>我</span>
              )}
              <span className={styles.speaker}>{isAgent ? agentName : '我'}</span>
            </div>
            <div className={`${styles.bubble} ${isAgent ? styles.bubbleAgent : styles.bubbleUser}`}>
              {msg.text}
              {typing && <span className={styles.caret} aria-hidden />}
              {msg.interrupted && <span className={styles.interruptTag}>已打断</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
