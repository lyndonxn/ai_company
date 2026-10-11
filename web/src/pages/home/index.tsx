import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AvatarOrb } from '@/components/AvatarOrb';
import { CloseIcon } from '@/components/icons';
import { fetchScenes, startSession } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { scenesError, scenesLoading, scenesReady, setActive, setPendingQuestion } from '@/store/slices/session';
import type { Scene } from '@/types';
import styles from './Home.module.css';

export default function Home() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { scenes, scenesStatus, scenesError: scenesErrMsg } = useAppSelector((s) => s.session);
  const [drawerScene, setDrawerScene] = useState<Scene | null>(null);
  const [pickedQuestion, setPickedQuestion] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    if (scenesStatus !== 'idle') return;
    dispatch(scenesLoading());
    fetchScenes()
      .then(({ scenes: list }) => dispatch(scenesReady(list)))
      .catch((err: Error) => dispatch(scenesError(err.message)));
  }, [dispatch, scenesStatus]);

  const openDrawer = useCallback((scene: Scene) => {
    setPickedQuestion(null);
    setStartError('');
    setDrawerScene(scene);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerScene(null);
  }, []);

  useEffect(() => {
    if (!drawerScene) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerScene, closeDrawer]);

  const beginCall = useCallback(
    async (scene: Scene, question: string | null) => {
      if (starting) return;
      setStarting(true);
      setStartError('');
      try {
        const { session } = await startSession(scene.id);
        dispatch(setActive({ session, scene, startedAt: Date.now() }));
        dispatch(setPendingQuestion(question));
        navigate(`/room/${session.sessionId}`);
      } catch (err) {
        setStartError(err instanceof Error ? err.message : String(err));
      } finally {
        setStarting(false);
      }
    },
    [dispatch, navigate, starting],
  );

  return (
    <div className={styles.page}>
      <AppHeader />

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>
            选一位 AI 同事
            <span className={styles.titleGrad}>,现在就聊</span>
          </h1>
          <p className={styles.subtitle}>
            发起语音会话,像和真实同事一样开口交流。当前为离线演示模式,字幕与状态由本地引擎模拟。
          </p>
        </section>

        {scenesStatus === 'loading' && (
          <div className={styles.grid} aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${styles.card} ${styles.skeleton}`} />
            ))}
          </div>
        )}

        {scenesStatus === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p>人设列表加载失败:{scenesErrMsg}</p>
            <button
              className={styles.retry}
              onClick={() => {
                dispatch(scenesLoading());
                fetchScenes()
                  .then(({ scenes: list }) => dispatch(scenesReady(list)))
                  .catch((err: Error) => dispatch(scenesError(err.message)));
              }}
            >
              重试
            </button>
          </div>
        )}

        {scenesStatus === 'ready' && (
          <div className={styles.grid}>
            {scenes.map((scene) => (
              <article key={scene.id} className={styles.card}>
                <button className={styles.cardBody} onClick={() => openDrawer(scene)}>
                  <div className={styles.orbRow}>
                    <AvatarOrb emoji={scene.avatar} accent={scene.accent} phase="listening" level={0} size={92} />
                  </div>
                  <div className={styles.cardHead}>
                    <h2 className={styles.name}>{scene.name}</h2>
                    <span className={styles.role}>{scene.role}</span>
                  </div>
                  <p className={styles.tagline}>{scene.tagline}</p>
                  <div className={styles.chips}>
                    {scene.questions.slice(0, 2).map((q) => (
                      <span key={q} className={styles.chip}>
                        {q}
                      </span>
                    ))}
                  </div>
                </button>
                <button
                  className={styles.startBtn}
                  disabled={starting}
                  onClick={() => beginCall(scene, null)}
                >
                  {starting ? '连接中…' : '开始通话'}
                </button>
              </article>
            ))}
          </div>
        )}
      </main>

      {drawerScene && (
        <div className={styles.drawerMask} onClick={closeDrawer}>
          <aside
            className={styles.drawer}
            style={{ ['--accent' as string]: drawerScene.accent }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${drawerScene.name} 详情`}
          >
            <button className={styles.drawerClose} onClick={closeDrawer} aria-label="关闭">
              <CloseIcon />
            </button>
            <div className={styles.drawerOrb}>
              <AvatarOrb emoji={drawerScene.avatar} accent={drawerScene.accent} phase="listening" level={0} size={120} />
            </div>
            <h3 className={styles.drawerName}>
              {drawerScene.name}
              <span className={styles.drawerRole}>{drawerScene.role}</span>
            </h3>
            <p className={styles.drawerGreeting}>“{drawerScene.greeting}”</p>
            <p className={styles.drawerHint}>可以从一个问题开始(可选):</p>
            <div className={styles.questionList}>
              {drawerScene.questions.map((q) => (
                <button
                  key={q}
                  className={`${styles.question} ${pickedQuestion === q ? styles.questionPicked : ''}`}
                  onClick={() => setPickedQuestion((cur) => (cur === q ? null : q))}
                >
                  {q}
                </button>
              ))}
            </div>
            {startError && (
              <p className={styles.startError} role="alert">
                {startError}
              </p>
            )}
            <button
              className={styles.drawerStart}
              disabled={starting}
              onClick={() => beginCall(drawerScene, pickedQuestion)}
            >
              {starting ? '正在创建会话…' : '开始通话'}
            </button>
          </aside>
        </div>
      )}

      <footer className={styles.footer}>AI Company · 演示环境,内容均由 AI 生成</footer>
    </div>
  );
}
