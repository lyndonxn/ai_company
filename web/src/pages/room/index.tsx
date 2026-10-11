import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AvatarOrb } from '@/components/AvatarOrb';
import { PhaseBadge } from '@/components/PhaseBadge';
import { fetchScenes, getSession, stopSession } from '@/api/client';
import { createVoiceEngine, type VoiceEngine } from '@/rtc';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearActive, setActive, setPendingQuestion } from '@/store/slices/session';
import {
  appendSubtitle,
  clearMessages,
  setError,
  setLevel,
  setPhase,
} from '@/store/slices/conversation';
import { setMicOn, toggleSubtitle } from '@/store/slices/devices';
import type { Scene, SessionInfo } from '@/types';
import { DemoInput } from './DemoInput';
import { ToolBar } from './ToolBar';
import { Transcript } from './Transcript';
import styles from './Room.module.css';

const BRAIN_BASE = (import.meta.env.VITE_BRAIN_BASE as string | undefined) || '/brain';

function fmtTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Room() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const active = useAppSelector((s) => s.session.active);
  const pendingQuestion = useAppSelector((s) => s.session.pendingQuestion);
  const phase = useAppSelector((s) => s.conversation.phase);
  const messages = useAppSelector((s) => s.conversation.messages);
  const level = useAppSelector((s) => s.conversation.level);
  const error = useAppSelector((s) => s.conversation.error);
  const micOn = useAppSelector((s) => s.devices.micOn);
  const showSubtitle = useAppSelector((s) => s.devices.showSubtitle);

  const [ready, setReady] = useState(
    Boolean(active && active.session.sessionId === sessionId),
  );
  const [leaving, setLeaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const engineRef = useRef<VoiceEngine | null>(null);
  const autoSentRef = useRef(false);

  const scene: Scene | null = active?.scene ?? null;
  const session: SessionInfo | null = active?.session ?? null;

  /** 恢复会话:刷新后 store 为空,经网关重建 */
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ session: record }, { scenes }] = await Promise.all([
          getSession(sessionId),
          fetchScenes(),
        ]);
        const found = scenes.find((s) => s.id === record.sceneId);
        if (!found) throw new Error('未找到该会话对应的人设');
        if (record.status && record.status !== 'active') throw new Error('会话已结束');
        if (!cancelled) {
          dispatch(setActive({ session: record, scene: found, startedAt: Date.now() }));
          setReady(true);
        }
      } catch {
        if (!cancelled) navigate('/', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, navigate, ready, sessionId]);

  /** 引擎生命周期:连接 → 启动会话(问候) */
  useEffect(() => {
    if (!ready || !scene || !session) return;
    const engine = createVoiceEngine();
    engineRef.current = engine;
    const offs = [
      engine.on('phase', (p) => dispatch(setPhase(p))),
      engine.on('subtitle', (sub) => dispatch(appendSubtitle(sub))),
      engine.on('level', (lv) => dispatch(setLevel(lv))),
      engine.on('error', (e) => dispatch(setError(e.message))),
    ];
    dispatch(clearMessages());
    dispatch(setPhase('connecting'));
    let disposed = false;
    (async () => {
      try {
        await engine.connect({ session, scene, brainBase: BRAIN_BASE });
        if (disposed) return;
        await engine.startSession();
      } catch (err) {
        if (!disposed) {
          dispatch(setError(err instanceof Error ? err.message : '连接失败'));
          dispatch(setPhase('listening'));
        }
      }
    })();
    return () => {
      disposed = true;
      offs.forEach((off) => off());
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.sessionId]);

  /** 快捷问题:首轮聆听时自动送出 */
  useEffect(() => {
    if (!autoSentRef.current && phase === 'listening' && pendingQuestion && engineRef.current) {
      autoSentRef.current = true;
      engineRef.current.sendUserText(pendingQuestion);
      dispatch(setPendingQuestion(null));
    }
  }, [phase, pendingQuestion, dispatch]);

  /** 会话计时 */
  useEffect(() => {
    if (!ready || leaving) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, leaving, sessionId]);

  const handleToggleMic = useCallback(async () => {
    const next = !micOn;
    dispatch(setMicOn(next));
    try {
      await engineRef.current?.setMicEnabled(next);
    } catch {
      /* mock 引擎不会抛错;真实引擎失败时保留开关状态提示 */
    }
  }, [dispatch, micOn]);

  const handleHangup = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    const engine = engineRef.current;
    try {
      await engine?.stopSession();
    } catch {
      /* 尽力而为 */
    }
    try {
      await engine?.disconnect();
    } catch {
      /* 尽力而为 */
    }
    engine?.dispose();
    if (session) {
      stopSession(session.sessionId).catch(() => {
        /* 网关清理失败不阻塞返回 */
      });
    }
    dispatch(clearActive());
    dispatch(clearMessages());
    navigate('/');
  }, [dispatch, leaving, navigate, session]);

  if (!ready || !scene || !session) {
    return (
      <div className={styles.page}>
        <AppHeader compact />
        <div className={styles.recovering}>
          <span className={styles.emptySpin} aria-hidden />
          正在恢复会话…
        </div>
      </div>
    );
  }

  const streaming = phase === 'speaking';

  return (
    <div className={`${styles.page} ${leaving ? styles.leaving : ''}`}>
      <AppHeader />

      <main className={styles.room}>
        {/* 舞台区 */}
        <section className={styles.stage}>
          <div className={styles.stageHead}>
            <h2 className={styles.sceneName}>
              {scene.name}
              <span className={styles.sceneRole}>{scene.role}</span>
            </h2>
            <span className={styles.timer} aria-label="通话时长">
              {fmtTime(elapsed)}
            </span>
          </div>

          <div className={styles.orbArea}>
            <AvatarOrb emoji={scene.avatar} accent={scene.accent} phase={phase} level={level} />
          </div>

          <div className={styles.badgeRow}>
            <PhaseBadge phase={phase} accent={scene.accent} />
          </div>

          {error && (
            <div className={styles.errorTip} role="alert">
              {error}
              <button className={styles.errorClose} onClick={() => dispatch(setError(undefined))} aria-label="关闭提示">
                ×
              </button>
            </div>
          )}
        </section>

        {/* 字幕区 */}
        {showSubtitle && (
          <section className={styles.transcriptPanel}>
            <Transcript
              messages={messages}
              accent={scene.accent}
              agentAvatar={scene.avatar}
              agentName={scene.name}
              streaming={streaming}
            />
            <DemoInput
              phase={phase}
              disabled={leaving}
              onSend={(text) => engineRef.current?.sendUserText(text)}
            />
          </section>
        )}
      </main>

      <ToolBar
        micOn={micOn}
        showSubtitle={showSubtitle}
        disabled={leaving}
        onToggleMic={handleToggleMic}
        onToggleSubtitle={() => dispatch(toggleSubtitle())}
        onHangup={handleHangup}
      />

      <footer className={styles.disclaimer}>AI 生成内容,请注意甄别</footer>
    </div>
  );
}
