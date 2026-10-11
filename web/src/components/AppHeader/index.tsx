import { useAppSelector } from '@/store/hooks';
import styles from './AppHeader.module.css';

export function AppHeader({ compact }: { compact?: boolean }) {
  const provider = useAppSelector((s) => s.session.active?.session.provider);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logoMark} aria-hidden>
          <span className={styles.logoDot} />
          <span className={styles.logoRing} />
        </span>
        <span className={styles.logoText}>AI Company</span>
        {!compact && <span className={styles.divider} />}
        {!compact && <span className={styles.slogan}>语音智能体工作台</span>}
      </div>
      {provider && (
        <span className={styles.providerBadge} title="当前语音引擎提供方">
          引擎 · {provider}
        </span>
      )}
    </header>
  );
}
