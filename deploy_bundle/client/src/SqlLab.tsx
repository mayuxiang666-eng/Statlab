import React, { useState, useEffect } from 'react';
import { message, Tag, Progress, Modal } from 'antd';
import { 
  BookOpen, CheckCircle, ChevronLeft, Award, 
  Trophy, Play, HelpCircle, FileText, Database,
  ArrowRight, Check, AlertCircle, Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SQL_LESSONS, SqlLesson, SqlQuizQuestion } from './SqlCourseData';
import { useAuth } from './context/AuthContext';

import { Language } from './locales';
import axios from 'axios';

type SelectionState = {
  lesson: SqlLesson | null;
  mode: 'content' | 'quiz' | null;
};

type ProgressState = {
  completed: string[]; // lesson ids
  score: number;
  quality: Record<string, { quizScore: number; passed: boolean }>;
};

const STORAGE_KEY = 'statlab_sql_learning_progress';

const SqlLab: React.FC<{ lang: Language }> = ({ lang }) => {
  const { user, token } = useAuth();
  const [selection, setSelection] = useState<SelectionState>({ lesson: null, mode: null });
  const [progress, setProgress] = useState<ProgressState>({ completed: [], score: 0, quality: {} });
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { checked: boolean; correct: boolean }>>({});
  const [showResultModal, setShowResultModal] = useState(false);

  const userId = user?.id || 'guest';
  const getStorageKey = () => `${STORAGE_KEY}_${userId}`;
  const getAuthHeader = () => token ? { Authorization: `Bearer ${token}` } : {};

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      const userKey = getStorageKey();
      const localSaved = localStorage.getItem(userKey);
      const localData: ProgressState = localSaved ? JSON.parse(localSaved) : { completed: [], score: 0, quality: {} };
      
      if (token && user) {
        try {
          const res = await axios.get('/api/learning/progress', { headers: getAuthHeader() });
          const remoteData = res.data;
          
          const merged: ProgressState = {
            completed: Array.from(new Set([...(remoteData.completed || []), ...(localData.completed || [])])),
            score: Math.max(remoteData.score || 0, localData.score || 0),
            quality: { ...(remoteData.quality || {}), ...(localData.quality || {}) }
          };
          
          setProgress(merged);
          localStorage.setItem(userKey, JSON.stringify(merged));
          
          if (localData.completed.length > (remoteData.completed?.length || 0)) {
            syncProgressToBackend(merged);
          }
        } catch (err) {
          console.error("Failed to load remote progress", err);
          setProgress(localData);
        }
      } else {
        setProgress(localData);
      }
    };

    loadProgress();
  }, [userId, token]);

  const syncProgressToBackend = async (next: ProgressState) => {
    if (!token) return;
    try {
      await axios.post('/api/learning/progress', next, { headers: getAuthHeader() });
    } catch (err) {
      console.error("Failed to sync progress to backend", err);
    }
  };

  const persistProgress = (next: ProgressState) => {
    setProgress(next);
    localStorage.setItem(getStorageKey(), JSON.stringify(next));
    if (token) syncProgressToBackend(next);
  };

  const handleStartLesson = (lesson: SqlLesson) => {
    setSelection({ lesson, mode: 'content' });
    window.scrollTo(0, 0);
  };

  const handleStartQuiz = () => {
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizResults({});
    setSelection(prev => ({ ...prev, mode: 'quiz' }));
    window.scrollTo(0, 0);
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (quizResults[questionId]?.checked) return;
    setQuizAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const checkAnswer = (question: SqlQuizQuestion) => {
    const answer = quizAnswers[question.id];
    if (answer === undefined) {
      message.warning(lang === 'zh' ? '请选择一个选项' : 'Please select an option');
      return;
    }
    const correct = answer === question.correctIndex;
    setQuizResults(prev => ({ ...prev, [question.id]: { checked: true, correct } }));
  };

  const nextQuiz = () => {
    if (quizIndex < (selection.lesson?.quiz.length || 0) - 1) {
      setQuizIndex(quizIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    if (!selection.lesson) return;
    const questions = selection.lesson.quiz;
    const correctCount = questions.filter(q => quizResults[q.id]?.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 80;

    const isFirstTime = !progress.completed.includes(selection.lesson.id);
    const nextProgress = {
      ...progress,
      completed: passed && isFirstTime ? [...progress.completed, selection.lesson.id] : progress.completed,
      score: passed && isFirstTime ? progress.score + selection.lesson.points : progress.score,
      quality: {
        ...progress.quality,
        [selection.lesson.id]: { quizScore: Math.max(progress.quality[selection.lesson.id]?.quizScore || 0, score), passed: passed || progress.quality[selection.lesson.id]?.passed || false }
      }
    };

    persistProgress(nextProgress);
    setShowResultModal(true);
  };

  const isLessonUnlocked = (lesson: SqlLesson) => {
    if (lesson.stage === 1) return true;
    const prevId = SQL_LESSONS.find(l => l.stage === lesson.stage - 1)?.id;
    return prevId ? progress.completed.includes(prevId) : true;
  };

  // --- Views ---

  const renderLessonList = () => (
    <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
      <div style={{ maxWidth: 1800, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              {lang === 'zh' ? 'SQL 数据处理中心' : 'SQL Data Processing Center'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {lang === 'zh' ? '循序渐进掌握 SQL 查询语言，从零开始成为数据处理专家。' : 'Master SQL step-by-step and become a data processing expert from scratch.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginBottom: 4 }}>
              <Trophy size={18} color="var(--accent)" />
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{progress.score}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>XP</span>
            </div>
            <Progress percent={Math.round((progress.completed.length / SQL_LESSONS.length) * 100)} size="small" strokeColor="var(--accent)" />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {SQL_LESSONS.map((lesson) => {
            const unlocked = isLessonUnlocked(lesson);
            const completed = progress.completed.includes(lesson.id);
            const bestScore = progress.quality[lesson.id]?.quizScore || 0;

            return (
              <div 
                key={lesson.id}
                onClick={() => unlocked && handleStartLesson(lesson)}
                className={`lesson-card ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''}`}
                style={{
                  background: completed ? 'rgba(255,154,0,0.03)' : 'var(--bg-raised)',
                  border: `1px solid ${completed ? 'rgba(255,154,0,0.2)' : 'var(--border)'}`,
                  borderRadius: 16,
                  padding: '24px 32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ 
                  width: 54, height: 54, borderRadius: 14, 
                  background: completed ? 'var(--accent)' : unlocked ? 'var(--bg-overlay)' : 'var(--bg-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: completed ? '#fff' : unlocked ? 'var(--accent)' : 'var(--text-muted)',
                  flexShrink: 0,
                  fontSize: 20,
                  fontWeight: 800
                }}>
                  {completed ? <Check size={28} strokeWidth={3} /> : lesson.stage}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {lang === 'zh' ? lesson.titleZh : lesson.titleEn}
                    </h3>
                    {completed && <Tag color="orange" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>PASSED</Tag>}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lang === 'zh' ? lesson.objectiveZh : lesson.objectiveEn}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{lang === 'zh' ? '用时' : 'Time'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{lesson.duration}</div>
                  </div>
                  {completed && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{lang === 'zh' ? '最高分' : 'Best'}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{bestScore}</div>
                    </div>
                  )}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: unlocked ? 'var(--bg-overlay)' : 'transparent', color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {unlocked ? <ArrowRight size={24} /> : <Database size={18} style={{ opacity: 0.3 }} />}
                  </div>
                </div>

                {!unlocked && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(240,240,240,0.6)', backdropFilter: 'grayscale(1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                     <div style={{ background: '#000', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                       <Database size={14} /> {lang === 'zh' ? '需完成前置关卡解锁' : 'Complete previous lesson to unlock'}
                     </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderLessonContent = () => (
    <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
      <div style={{ maxWidth: 1700, margin: '0 auto', padding: '0 40px' }}>
        <button 
          onClick={() => setSelection({ lesson: null, mode: null })}
          className="btn-back"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 32 }}
        >
          <ChevronLeft size={16} /> {lang === 'zh' ? '返回课程列表' : 'Back to Lessons'}
        </button>

        <div style={{ background: 'var(--bg-raised)', borderRadius: 24, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '40px 60px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to bottom right, var(--bg-raised), #fff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)', textTransform: 'uppercase' }}>
                Lesson {selection.lesson?.stage}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{selection.lesson?.duration} · {lang === 'zh' ? '基础入门' : 'Essentials'}</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 20 }}>
              {lang === 'zh' ? selection.lesson?.titleZh : selection.lesson?.titleEn}
            </h1>
            <div style={{ padding: '16px 20px', background: 'var(--bg-overlay)', borderRadius: 16, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{lang === 'zh' ? '学习目标' : 'Objective'}</div>
              {lang === 'zh' ? selection.lesson?.objectiveZh : selection.lesson?.objectiveEn}
            </div>
          </div>

          <div className="markdown-body" style={{ padding: '60px', fontSize: 17, lineHeight: 1.8, color: '#1e293b' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {lang === 'zh' ? selection.lesson?.contentZh || '' : selection.lesson?.contentEn || ''}
            </ReactMarkdown>
          </div>

          <div style={{ padding: '40px 60px', background: 'var(--bg-overlay)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <Award size={24} color="var(--accent)" />
               <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                 {lang === 'zh' ? `完成挑战可获得 ${selection.lesson?.points} XP` : `Complete challenge to earn ${selection.lesson?.points} XP`}
               </span>
            </div>
            <button 
              onClick={handleStartQuiz}
              className="btn-primary"
              style={{ padding: '12px 40px', borderRadius: 12, height: 52, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              {lang === 'zh' ? '进入知识测验' : 'Enter Knowledge Quiz'} <Play size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuizMode = () => {
    const question = selection.lesson?.quiz[quizIndex];
    if (!question) return null;

    const total = selection.lesson?.quiz.length || 0;
    const progressPct = ((quizIndex + 1) / total) * 100;
    const answered = quizAnswers[question.id] !== undefined;
    const checked = quizResults[question.id]?.checked;
    const correct = quizResults[question.id]?.correct;

    return (
      <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
        <div style={{ maxWidth: 1700, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>{lang === 'zh' ? '挑战进行中...' : 'Challenge in progress...'}</span>
                <span>{quizIndex + 1} / {total}</span>
              </div>
              <Progress percent={progressPct} showInfo={false} strokeColor="var(--accent)" trailColor="var(--bg-overlay)" strokeWidth={10} />
            </div>
            <button 
              onClick={() => setSelection(prev => ({ ...prev, mode: 'content' }))}
              style={{ marginLeft: 32, padding: '10px 20px', borderRadius: 10, background: 'var(--bg-soft)', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {lang === 'zh' ? '中途退出' : 'Exit Quiz'}
            </button>
          </div>

          <div style={{ background: 'var(--bg-raised)', borderRadius: 32, border: '1px solid var(--border)', padding: '60px', boxShadow: '0 12px 50px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                 <HelpCircle size={24} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>
                {lang === 'zh' ? question.questionZh : question.questionEn}
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 40 }}>
              {(lang === 'zh' ? question.optionsZh : question.optionsEn).map((opt, i) => {
                const isSelected = quizAnswers[question.id] === i;
                const isCorrect = question.correctIndex === i;
                let bgColor = 'var(--bg-soft)';
                let borderColor = 'var(--border)';
                let textColor = 'var(--text-primary)';

                if (checked) {
                  if (isCorrect) {
                    bgColor = '#f0fdf4'; borderColor = '#16a34a'; textColor = '#166534';
                  } else if (isSelected) {
                    bgColor = '#fef2f2'; borderColor = '#ef4444'; textColor = '#991b1b';
                  }
                } else if (isSelected) {
                  borderColor = 'var(--accent)'; bgColor = 'rgba(255,154,0,0.05)';
                }

                return (
                  <div 
                    key={i}
                    onClick={() => handleAnswer(question.id, i)}
                    style={{
                      padding: '24px 30px', borderRadius: 20, border: `3px solid ${borderColor}`,
                      background: bgColor, color: textColor, cursor: checked ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 20, transition: 'all 0.2s',
                      fontSize: 16, fontWeight: 600
                    }}
                  >
                    <div style={{ 
                      width: 34, height: 34, borderRadius: '50%', border: `2.5px solid ${isSelected || (checked && isCorrect) ? 'transparent' : 'var(--border)'}`,
                      background: isSelected || (checked && isCorrect) ? (checked && !isCorrect ? '#ef4444' : (checked ? '#16a34a' : 'var(--accent)')) : 'transparent',
                      color: isSelected || (checked && isCorrect) ? '#fff' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800
                    }}>
                      {checked && isCorrect ? <Check size={18} strokeWidth={3} /> : String.fromCharCode(65 + i)}
                    </div>
                    {opt}
                  </div>
                );
              })}
            </div>

            {checked && (
              <div className="animate-fade-up" style={{ padding: '24px 30px', borderRadius: 20, background: correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${correct ? '#bcf0da' : '#fecaca'}`, marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  {correct ? <Sparkles size={20} color="#16a34a" /> : <AlertCircle size={20} color="#dc2626" />}
                  <b style={{ fontSize: 15, color: correct ? '#166534' : '#991b1b' }}>
                    {correct ? (lang === 'zh' ? '回答正确！' : 'Excellent!') : (lang === 'zh' ? '回答错误' : 'Not quite right')}
                  </b>
                </div>
                <p style={{ margin: 0, fontSize: 15, color: correct ? '#15803d' : '#b91c1c', lineHeight: 1.6 }}>
                  {lang === 'zh' ? question.explanationZh : question.explanationEn}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {!checked ? (
                <button 
                  onClick={() => checkAnswer(question)}
                  disabled={!answered}
                  className="btn-primary"
                  style={{ padding: '14px 60px', borderRadius: 14, fontSize: 16, fontWeight: 800, opacity: answered ? 1 : 0.5 }}
                >
                  {lang === 'zh' ? '检查答案' : 'Check Answer'}
                </button>
              ) : (
                <button 
                  onClick={nextQuiz}
                  className="btn-primary"
                  style={{ padding: '14px 60px', borderRadius: 14, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {quizIndex < total - 1 ? (lang === 'zh' ? '下一题' : 'Next Question') : (lang === 'zh' ? '完成挑战' : 'Finish Challenge')} 
                  <ArrowRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-base)', padding: '0 40px' }}>
      <style>{`
        .lesson-card:hover.unlocked { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: var(--accent) !important; }
        .lesson-card.completed { background: linear-gradient(to right, rgba(255,154,0,0.06), #fff) !important; }
        .markdown-body h2 { margin-top: 32px; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 12px; font-size: 24px; color: #0f172a; }
        .markdown-body h3 { margin-top: 24px; font-weight: 700; font-size: 20px; color: #1e293b; }
        .markdown-body p { margin: 20px 0; font-size: 17px; }
        .markdown-body pre { background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; overflow-x: auto; margin: 24px 0; border: 1px solid rgba(255,255,255,0.1); }
        .markdown-body code:not(pre code) { background: var(--bg-overlay); color: var(--accent); padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 0.9em; }
        .markdown-body ul, .markdown-body ol { padding-left: 24px; margin: 20px 0; }
        .markdown-body li { margin-bottom: 12px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>
      
      {!selection.lesson && renderLessonList()}
      {selection.lesson && selection.mode === 'content' && renderLessonContent()}
      {selection.lesson && selection.mode === 'quiz' && renderQuizMode()}

      <Modal
        visible={showResultModal}
        footer={null}
        closable={false}
        centered
        width={480}
        bodyStyle={{ padding: 48, textAlign: 'center' }}
      >
        {(() => {
          const correctCount = selection.lesson?.quiz.filter(q => quizResults[q.id]?.correct).length || 0;
          const total = selection.lesson?.quiz.length || 0;
          const score = Math.round((correctCount / total) * 100);
          const passed = score >= 80;

          return (
            <div className="animate-fade">
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: passed ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: passed ? '#16a34a' : '#ef4444' }}>
                {passed ? <Trophy size={44} /> : <AlertCircle size={44} />}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 12 }}>{passed ? (lang === 'zh' ? '关卡已攻克！' : 'Lesson Mastered!') : (lang === 'zh' ? '未达到通过分数' : 'Not Quite There')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
                {lang === 'zh' ? `恭喜！本次知识挑战答对了 ${correctCount}/${total} 题，得分 ${score}。` : `Congrats! You got ${correctCount}/${total} questions correct, score: ${score}.`}
                {!passed && (lang === 'zh' ? ' 为确保掌握程度，需 80 分以上方可开启后续章节。' : ' You need 80+ score to unlock subsequent chapters.')}
              </p>
              
              <div style={{ display: 'grid', gap: 12 }}>
                {passed ? (
                  <button 
                    onClick={() => { setShowResultModal(false); setSelection({ lesson: null, mode: null }); }}
                    className="btn-primary"
                    style={{ padding: '14px 0', borderRadius: 14, fontWeight: 800, fontSize: 16 }}
                  >
                    {lang === 'zh' ? '领取奖励：返回大厅' : 'Claim Rewards & Exit'}
                  </button>
                ) : (
                  <button 
                    onClick={() => { setShowResultModal(false); handleStartQuiz(); }}
                    className="btn-primary"
                    style={{ padding: '14px 0', borderRadius: 14, fontWeight: 800, fontSize: 16 }}
                  >
                    {lang === 'zh' ? '再挑战一次' : 'Try Again'}
                  </button>
                )}
                {!passed && (
                  <button 
                    onClick={() => { setShowResultModal(false); setSelection(prev => ({ ...prev, mode: 'content' })); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                  >
                    {lang === 'zh' ? '先复习讲义' : 'Review Lesson'}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default SqlLab;
