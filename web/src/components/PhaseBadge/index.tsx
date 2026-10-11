import type { AgentPhase } from '@/store/slices/conversation';
import styles from './PhaseBadge.module.css';

const LABELS: Record<AgentPhase, string> = {
  connecting: '连接中',
  listening: '聆听中',
  thinking: '思考中',
  speaking: '说话中',
};

interface PhaseBadgeProps {
  phase: AgentPhase;
  accent: string;
}

export function PhaseBadge({ phase, accent }: PhaseBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[phase]}`}
      style={{ ['--accent' as string]: accent }}
      role="status"
      aria-live="polite"
    >
      {phase === 'speaking' && (
        <span className={styles.bars} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
      {phase === 'thinking' && <span className={styles.dots} aria-hidden>···</span>}
      {LABELS[phase]}
    </span>
  );
}
