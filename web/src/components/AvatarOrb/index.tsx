import type { AgentPhase } from '@/store/slices/conversation';
import styles from './AvatarOrb.module.css';

interface AvatarOrbProps {
  emoji: string;
  accent: string;
  phase: AgentPhase;
  level: number;
  size?: number;
}

/**
 * AI 头像光球:说话时波纹扩散 + 电平呼吸;思考时慢速脉冲;聆听时静态微光。
 */
export function AvatarOrb({ emoji, accent, phase, level, size = 168 }: AvatarOrbProps) {
  const speaking = phase === 'speaking';
  const thinking = phase === 'thinking';
  const scale = speaking ? 1 + Math.min(level, 1) * 0.07 : 1;

  return (
    <div
      className={`${styles.orb} ${speaking ? styles.speaking : ''} ${thinking ? styles.thinking : ''}`}
      style={{ width: size, height: size, ['--accent' as string]: accent }}
      role="img"
      aria-label={`AI 头像:${emoji}`}
    >
      <span className={styles.ring} />
      <span className={`${styles.ring} ${styles.ringSlow}`} />
      <span className={styles.ringAlt} />
      <div className={styles.face} style={{ transform: `scale(${scale})` }}>
        <span className={styles.emoji}>{emoji}</span>
      </div>
    </div>
  );
}
