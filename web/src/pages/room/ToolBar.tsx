import { HangupIcon, MicIcon, MicOffIcon, SubtitleIcon } from '@/components/icons';
import styles from './Room.module.css';

interface ToolBarProps {
  micOn: boolean;
  showSubtitle: boolean;
  disabled: boolean;
  onToggleMic: () => void;
  onToggleSubtitle: () => void;
  onHangup: () => void;
}

export function ToolBar({
  micOn,
  showSubtitle,
  disabled,
  onToggleMic,
  onToggleSubtitle,
  onHangup,
}: ToolBarProps) {
  return (
    <div className={styles.toolBar}>
      <button
        className={`${styles.toolBtn} ${micOn ? styles.toolOn : styles.toolOff}`}
        onClick={onToggleMic}
        disabled={disabled}
        title={micOn ? '麦克风已开启,点击关闭' : '麦克风已关闭,点击开启(说话将打断 AI)'}
        aria-pressed={micOn}
        aria-label="麦克风开关"
      >
        {micOn ? <MicIcon /> : <MicOffIcon />}
      </button>

      <button className={styles.hangup} onClick={onHangup} disabled={disabled} aria-label="挂断">
        <HangupIcon />
        <span>挂断</span>
      </button>

      <button
        className={`${styles.toolBtn} ${showSubtitle ? styles.toolOn : styles.toolOff}`}
        onClick={onToggleSubtitle}
        disabled={disabled}
        title={showSubtitle ? '字幕已显示,点击隐藏' : '字幕已隐藏,点击显示'}
        aria-pressed={showSubtitle}
        aria-label="字幕开关"
      >
        <SubtitleIcon />
      </button>
    </div>
  );
}
