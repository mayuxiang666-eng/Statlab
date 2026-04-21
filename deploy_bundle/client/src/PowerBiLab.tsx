import React, { useState, useEffect } from 'react';
import { message, Tag, Progress, Modal, Input, Button, Tabs } from 'antd';
import { 
  BarChart3, CheckCircle, ChevronLeft, Award, 
  Trophy, Play, HelpCircle, FileText, Database,
  ArrowRight, Check, AlertCircle, Sparkles, Layout,
  Network, Search, Settings, Edit2, Plus, Save
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PowerBiLesson, PowerBiQuizQuestion } from './PowerBiCourseData';
import { useAuth } from './context/AuthContext';

const { TextArea } = Input;
const { TabPane } = Tabs;
import { DAX_FUNCTIONS, DaxFunction } from './PowerBiDaxLibrary';

import { Language } from './locales';
import axios from 'axios';

type SelectionState = {
  lesson: PowerBiLesson | null;
  mode: 'content' | 'quiz' | 'reference' | null;
};

type ProgressState = {
  completed: string[]; // lesson ids
  score: number;
  quality: Record<string, { quizScore: number; passed: boolean }>;
};

const STORAGE_KEY = 'statlab_pbi_learning_progress';
const ACCENT_COLOR = '#eab308'; // Power BI Gold/Yellow
const ACCENT_DIM = 'rgba(234, 179, 8, 0.1)';

const PowerBiLab: React.FC<{ lang: Language }> = ({ lang }) => {
  const { user, token } = useAuth();
  const [selection, setSelection] = useState<SelectionState>({ lesson: null, mode: null });
  const [progress, setProgress] = useState<ProgressState>({ completed: [], score: 0, quality: {} });
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { checked: boolean; correct: boolean }>>({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [searchCategory, setSearchCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lessons, setLessons] = useState<PowerBiLesson[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLesson, setEditingLesson] = useState<PowerBiLesson | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const isAdmin = user?.username === 'admin' || user?.username === 'root';

  const userId = user?.id || 'guest';
  const getStorageKey = () => `${STORAGE_KEY}_${userId}`;
  const getAuthHeaders = () => token ? { Authorization: `Bearer ${token}` } : {};

  // Fetch Lessons
  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await axios.get('/api/powerbi/lessons');
        setLessons(res.data);
      } catch (err) {
        console.error("Failed to fetch lessons", err);
        // Fallback to static data if needed, but the server should have it now
        import('./PowerBiCourseData').then(m => setLessons(m.POWERBI_LESSONS));
      } finally {
        setInitialLoading(false);
      }
    };
    fetchLessons();
  }, []);

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      const userKey = getStorageKey();
      const localSaved = localStorage.getItem(userKey);
      const localData: ProgressState = localSaved ? JSON.parse(localSaved) : { completed: [], score: 0, quality: {} };
      
      if (token && user) {
        try {
          const res = await axios.get('/api/learning/progress', { headers: getAuthHeaders() });
          const remoteData = res.data;
          
          // Strategy: Merge current user's local keyed data with remote data
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
      await axios.post('/api/learning/progress', next, { headers: getAuthHeaders() });
    } catch (err) {
      console.error("Failed to sync progress to backend", err);
    }
  };

  const persistProgress = (next: ProgressState) => {
    setProgress(next);
    localStorage.setItem(getStorageKey(), JSON.stringify(next));
    if (token) syncProgressToBackend(next);
  };

  const handleStartLesson = (lesson: PowerBiLesson) => {
    setSelection({ lesson, mode: 'content' });
    window.scrollTo(0, 0);
  };

  const handleStartChallenge = () => {
    handleStartQuiz();
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

  const checkAnswer = (question: PowerBiQuizQuestion) => {
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
    const questions = selection.lesson.quiz || [];
    const correctCount = questions.filter(q => quizResults[q.id]?.correct).length;
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
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

  const isLessonUnlocked = (lesson: PowerBiLesson) => {
    if (isAdmin) return true;
    if (lesson.stage === 1) return true;
    const prevId = lessons.find(l => l.stage === lesson.stage - 1)?.id;
    return prevId ? progress.completed.includes(prevId) : true;
  };

  const handleEditClick = (e: React.MouseEvent, lesson: PowerBiLesson) => {
    e.stopPropagation();
    setEditingLesson({ ...lesson });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLesson || !token) return;
    try {
      const res = await axios.post(`/api/powerbi/lessons/${editingLesson.id}`, editingLesson, { headers: getAuthHeaders() });
      if (res.data.ok) {
        message.success(lang === 'zh' ? '保存成功' : 'Saved successfully');
        setLessons(prev => prev.map(l => l.id === editingLesson.id ? res.data.lesson : l));
        if (selection.lesson?.id === editingLesson.id) {
          setSelection(prev => ({ ...prev, lesson: res.data.lesson }));
        }
        setIsEditing(false);
      }
    } catch (err) {
      message.error(lang === 'zh' ? '保存失败' : 'Failed to save');
    }
  };

  // --- Views ---

  const renderLessonList = () => (
    <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
      <div style={{ maxWidth: 1800, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              {lang === 'zh' ? 'Power BI 权威指导手册' : 'Power BI Expert Manual'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {lang === 'zh' ? '掌握 Power BI 核心组件、Power Query ETL、星型建模与 DAX 高级函数库。' : 'Master Power BI components, Power Query ETL, Star Schema, and Advanced DAX Library.'}
            </p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button 
              onClick={() => setSelection({ lesson: null, mode: 'reference' })}
              style={{ padding: '10px 24px', borderRadius: 12, background: 'var(--bg-soft)', border: `1px solid ${ACCENT_COLOR}44`, color: ACCENT_COLOR, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Search size={16} /> {lang === 'zh' ? '函数查询与学习' : 'Function Library'}
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginBottom: 4 }}>
                <Trophy size={18} color={ACCENT_COLOR} />
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{progress.score}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>XP</span>
              </div>
              <Progress percent={lessons.length > 0 ? Math.round((progress.completed.length / lessons.length) * 100) : 0} size="small" strokeColor={ACCENT_COLOR} />
            </div>
          </div>
        </div>

        {initialLoading ? (
            <div style={{ padding: 100, textAlign: 'center', color: 'var(--text-muted)' }}>Loading lessons...</div>
        ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {lessons.map((lesson) => {
            const unlocked = isLessonUnlocked(lesson);
            const completed = progress.completed.includes(lesson.id);
            const bestScore = progress.quality[lesson.id]?.quizScore || 0;

            return (
              <div 
                key={lesson.id}
                onClick={() => unlocked && handleStartLesson(lesson)}
                className={`lesson-card ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''}`}
                style={{
                  background: completed ? 'rgba(234,179,8,0.03)' : 'var(--bg-raised)',
                  border: `1px solid ${completed ? 'rgba(234,179,8,0.2)' : 'var(--border)'}`,
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
                  background: completed ? ACCENT_COLOR : unlocked ? 'var(--bg-overlay)' : 'var(--bg-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: completed ? '#fff' : unlocked ? ACCENT_COLOR : 'var(--text-muted)',
                  flexShrink: 0,
                  fontSize: 20,
                  fontWeight: 800
                }}>
                  {completed ? <Check size={28} strokeWidth={3} /> : lesson.stage}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: (unlocked || isAdmin) ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {lang === 'zh' ? lesson.titleZh : lesson.titleEn}
                    </h3>
                    {completed && <Tag color="gold" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>MASTERED</Tag>}
                    {isAdmin && (
                        <div 
                           onClick={(e) => handleEditClick(e, lesson)}
                           style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-soft)', color: ACCENT_COLOR, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, border: '1px solid var(--border)' }}
                        >
                           <Settings size={14} /> {lang === 'zh' ? '编辑' : 'Edit'}
                        </div>
                    )}
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
                      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT_COLOR }}>{bestScore}</div>
                    </div>
                  )}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: unlocked ? 'var(--bg-overlay)' : 'transparent', color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {unlocked ? <ArrowRight size={24} /> : <BarChart3 size={18} style={{ opacity: 0.3 }} />}
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
        )}
      </div>
    </div>
  );

  const renderLessonContent = () => (
    <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
      <div style={{ maxWidth: 1700, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <button 
            onClick={() => setSelection({ lesson: null, mode: null })}
            className="btn-back"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <ChevronLeft size={16} /> {lang === 'zh' ? '返回课程列表' : 'Back to Lessons'}
          </button>

          {isAdmin && (
              <button 
                onClick={(e) => selection.lesson && handleEditClick(e as any, selection.lesson)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: ACCENT_COLOR, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Edit2 size={16} /> {lang === 'zh' ? '编辑本节内容' : 'Edit This Lesson'}
              </button>
          )}
        </div>

        <div style={{ background: 'var(--bg-raised)', borderRadius: 24, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '40px 60px', borderBottom: '1px solid var(--border)', background: `linear-gradient(to bottom right, var(--bg-raised), #fff)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: ACCENT_DIM, color: ACCENT_COLOR, textTransform: 'uppercase' }}>
                Lesson {selection.lesson?.stage}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{selection.lesson?.duration} · {lang === 'zh' ? 'BI 精英之路' : 'Expert BI'}</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 20 }}>
              {lang === 'zh' ? selection.lesson?.titleZh : selection.lesson?.titleEn}
            </h1>
            <div style={{ padding: '16px 20px', background: 'var(--bg-overlay)', borderRadius: 16, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, borderLeft: `4px solid ${ACCENT_COLOR}` }}>
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
               <Award size={24} color={ACCENT_COLOR} />
               <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                 {lang === 'zh' ? `完成挑战可获得 ${selection.lesson?.points} XP` : `Complete challenge to earn ${selection.lesson?.points} XP`}
               </span>
            </div>
            <button 
              onClick={handleStartChallenge}
              className="btn-primary"
              style={{ background: ACCENT_COLOR, border: 'none', padding: '12px 40px', borderRadius: 12, height: 52, fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              {lang === 'zh' ? '开始知识挑战' : 'Start Knowledge Quiz'} <Play size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuizMode = () => {
    const question = selection.lesson?.quiz?.[quizIndex];
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
              <Progress percent={progressPct} showInfo={false} strokeColor={ACCENT_COLOR} trailColor="var(--bg-overlay)" strokeWidth={10} />
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
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT_COLOR, flexShrink: 0 }}>
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
                  borderColor = ACCENT_COLOR; bgColor = ACCENT_DIM;
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
                      background: isSelected || (checked && isCorrect) ? (checked && !isCorrect ? '#ef4444' : (checked ? '#16a34a' : ACCENT_COLOR)) : 'transparent',
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
                  style={{ background: ACCENT_COLOR, border: 'none', color: '#fff', padding: '14px 60px', borderRadius: 14, fontSize: 16, fontWeight: 800, opacity: answered ? 1 : 0.5, cursor: answered ? 'pointer' : 'not-allowed' }}
                >
                  {lang === 'zh' ? '检查答案' : 'Check Answer'}
                </button>
              ) : (
                <button 
                  onClick={nextQuiz}
                  className="btn-primary"
                  style={{ background: ACCENT_COLOR, border: 'none', color: '#fff', padding: '14px 60px', borderRadius: 14, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
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

  const renderReferenceMode = () => {
    const categories = ['All', 'Aggregation', 'Filter', 'Time Intelligence', 'Logical', 'Table', 'Text', 'Information', 'Math'];
    const filtered = DAX_FUNCTIONS.filter(f => {
      const matchCat = searchCategory === 'All' || f.category === searchCategory;
      const matchSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          f.descriptionZh.includes(searchTerm) || 
                          f.descriptionEn.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });

    return (
      <div className="animate-fade" style={{ width: '100%', padding: '20px 0' }}>
        <div style={{ maxWidth: 1800, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{lang === 'zh' ? 'DAX 函数参考与学习馆' : 'DAX Reference & Learning Hub'}</h2>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{lang === 'zh' ? '掌握常用的工业 DAX 函数，助力高效建模' : 'Mastering common industrial DAX functions'}</p>
            </div>
            <button 
              onClick={() => setSelection({ lesson: null, mode: null })}
              style={{ padding: '10px 24px', borderRadius: 12, background: 'var(--bg-soft)', border: 'none', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
            >
              {lang === 'zh' ? '返回首页' : 'Home'}
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 24, border: '1px solid var(--border-color)', marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                <input 
                  type="text" 
                  placeholder={lang === 'zh' ? '输入函数名或关键词搜索...' : 'Search for functions...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', height: 48, background: 'var(--bg-soft)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0 16px 0 48px', color: 'var(--text-primary)', fontSize: 15 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSearchCategory(cat)}
                  style={{ 
                    padding: '8px 16px', borderRadius: 100, border: '1px solid var(--border-color)', 
                    background: searchCategory === cat ? ACCENT_COLOR : 'transparent',
                    color: searchCategory === cat ? '#fff' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {cat === 'All' ? (lang === 'zh' ? '全部' : 'All') : cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
            {filtered.map(f => (
              <div 
                key={f.name}
                style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 0.3s ease' }}
                className="dax-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT_COLOR }} />
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{f.name}</h3>
                   </div>
                   <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-soft)', padding: '4px 8px', borderRadius: 6, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{f.category}</span>
                </div>
                <code style={{ background: 'var(--bg-soft)', padding: '10px 14px', borderRadius: 8, color: ACCENT_COLOR, fontSize: 13 }}>{f.syntax}</code>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{lang === 'zh' ? f.descriptionZh : f.descriptionEn}</p>
                <div style={{ padding: '12px', background: 'rgba(234,179,8,0.02)', borderRadius: 10, borderLeft: `3px solid ${ACCENT_COLOR}` }}>
                   <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT_COLOR, marginBottom: 4 }}>EXAMPLE</div>
                   <code style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{f.example}</code>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
                  <b style={{ color: 'var(--text-secondary)' }}>TIP:</b> {lang === 'zh' ? f.tipZh : f.tipEn}
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
              {lang === 'zh' ? '未找到匹配的函数' : 'No functions found.'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="statlab-container animate-fade" style={{ background: 'var(--bg-main)', height: '100%', width: '100%', overflowY: 'auto', position: 'relative' }}>
      <style>{`
        .lesson-card:hover.unlocked { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: ${ACCENT_COLOR} !important; }
        .dax-card:hover { border-color: ${ACCENT_COLOR} !important; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
        .lesson-card.completed { background: linear-gradient(to right, ${ACCENT_DIM}, #fff) !important; }
        .markdown-body h2 { margin-top: 32px; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 12px; font-size: 24px; color: #0f172a; }
        .markdown-body h3 { margin-top: 24px; font-weight: 700; font-size: 20px; color: #1e293b; }
        .markdown-body p { margin: 20px 0; font-size: 17px; }
        .markdown-body pre { background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; overflow-x: auto; margin: 24px 0; border: 1px solid rgba(255,255,255,0.1); }
        .markdown-body code:not(pre code) { background: var(--bg-overlay); color: ${ACCENT_COLOR}; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 0.9em; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>
      
      {!selection.lesson && !selection.mode && renderLessonList()}
      {selection.lesson && selection.mode === 'content' && renderLessonContent()}
      {selection.mode === 'reference' && renderReferenceMode()}
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
          const quiz = selection.lesson?.quiz || [];
          const correctCount = quiz.filter(q => quizResults[q.id]?.correct).length;
          const total = quiz.length;
          const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
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
                    style={{ background: ACCENT_COLOR, border: 'none', color: '#fff', padding: '14px 0', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                  >
                    {lang === 'zh' ? '领取奖励：返回大厅' : 'Claim Rewards & Exit'}
                  </button>
                ) : (
                  <button 
                    onClick={() => { setShowResultModal(false); handleStartQuiz(); }}
                    className="btn-primary"
                    style={{ background: ACCENT_COLOR, border: 'none', color: '#fff', padding: '14px 0', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
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

      <Modal
        title={lang === 'zh' ? '编辑课程内容' : 'Edit Lesson Content'}
        visible={isEditing}
        onCancel={() => setIsEditing(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsEditing(false)}>{lang === 'zh' ? '取消' : 'Cancel'}</Button>,
          <Button key="save" type="primary" icon={<Save size={16} />} onClick={handleSaveEdit}>{lang === 'zh' ? '保存' : 'Save'}</Button>
        ]}
        width={1000}
        bodyStyle={{ padding: 24, maxHeight: '80vh', overflowY: 'auto' }}
      >
        {editingLesson && (
          <Tabs defaultActiveKey="1">
            <TabPane tab={lang === 'zh' ? '基本信息 & 内容' : 'Basic Info & Content'} key="1">
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>ID (Unique)</label>
                  <Input disabled value={editingLesson.id} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>标题 (中文)</label>
                    <Input value={editingLesson.titleZh} onChange={e => setEditingLesson({ ...editingLesson, titleZh: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Title (English)</label>
                    <Input value={editingLesson.titleEn} onChange={e => setEditingLesson({ ...editingLesson, titleEn: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>目标 (中文)</label>
                    <Input value={editingLesson.objectiveZh} onChange={e => setEditingLesson({ ...editingLesson, objectiveZh: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Objective (English)</label>
                    <Input value={editingLesson.objectiveEn} onChange={e => setEditingLesson({ ...editingLesson, objectiveEn: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>正文内容 (Markdown - 中文)</label>
                  <TextArea 
                    rows={12} 
                    value={editingLesson.contentZh} 
                    onChange={e => setEditingLesson({ ...editingLesson, contentZh: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Content (Markdown - English)</label>
                  <TextArea 
                    rows={12} 
                    value={editingLesson.contentEn} 
                    onChange={e => setEditingLesson({ ...editingLesson, contentEn: e.target.value })} 
                  />
                </div>
              </div>
            </TabPane>
            <TabPane tab={lang === 'zh' ? '知识挑战 (Quiz)' : 'Knowledge Quiz'} key="2">
              <div style={{ display: 'grid', gap: 24 }}>
                {editingLesson.quiz.map((q, qIndex) => (
                  <div key={q.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 16, color: ACCENT_COLOR }}>Question {qIndex + 1}</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <Input value={q.questionZh} onChange={e => {
                        const nextQuiz = [...editingLesson.quiz];
                        nextQuiz[qIndex] = { ...q, questionZh: e.target.value };
                        setEditingLesson({ ...editingLesson, quiz: nextQuiz });
                      }} placeholder="问题 (中文)" />
                      <Input value={q.questionEn} onChange={e => {
                        const nextQuiz = [...editingLesson.quiz];
                        nextQuiz[qIndex] = { ...q, questionEn: e.target.value };
                        setEditingLesson({ ...editingLesson, quiz: nextQuiz });
                      }} placeholder="Question (English)" />
                      
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>选项 / Options</div>
                        {q.optionsZh.map((opt, oIndex) => (
                          <div key={oIndex} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                             <Input 
                               value={opt} 
                               onChange={e => {
                                 const nextQuiz = [...editingLesson.quiz];
                                 const nextOpts = [...q.optionsZh];
                                 nextOpts[oIndex] = e.target.value;
                                 nextQuiz[qIndex] = { ...q, optionsZh: nextOpts };
                                 setEditingLesson({ ...editingLesson, quiz: nextQuiz });
                               }} 
                               prefix={<span style={{ fontWeight: 800, marginRight: 8 }}>{String.fromCharCode(65 + oIndex)}</span>}
                             />
                             <Button 
                                type={q.correctIndex === oIndex ? 'primary' : 'default'}
                                onClick={() => {
                                  const nextQuiz = [...editingLesson.quiz];
                                  nextQuiz[qIndex] = { ...q, correctIndex: oIndex };
                                  setEditingLesson({ ...editingLesson, quiz: nextQuiz });
                                }}
                             >
                               {q.correctIndex === oIndex ? 'CORRECT' : 'SET'}
                             </Button>
                          </div>
                        ))}
                      </div>

                      <TextArea 
                        placeholder="解析 (中文)" 
                        value={q.explanationZh} 
                        onChange={e => {
                          const nextQuiz = [...editingLesson.quiz];
                          nextQuiz[qIndex] = { ...q, explanationZh: e.target.value };
                          setEditingLesson({ ...editingLesson, quiz: nextQuiz });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
};

export default PowerBiLab;
