import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { 
  Activity, Award, BookOpen, Check, CheckCircle, ChevronRight, Copy, FileText, 
  Layers, Lock, Play, RefreshCcw, Star, Target, Trophy, User, XCircle, Zap 
} from 'lucide-react';
import { LAB_COURSES } from './CourseData';

type LabTab = 'notebooks' | 'assignments' | 'achievements';

interface LabPortalProps {
  initialTab?: LabTab;
  onGoToCourse: (courseId: string) => void;
}

type QualityState = {
  attempts: number;
  retries: number;
  firstPass: boolean;
  passedCheckpoints: number;
  challengeAttempts: number;
  challengeBestScore: number;
  challengePassed: boolean;
};

type ProgressState = {
  completed: string[];
  score: number;
  badges: string[];
  quality: Record<string, QualityState>;
};

type ExerciseRunRecord = {
  id: string;
  ts: string;
  courseId: string;
  courseTitle: string;
  cellId: string;
  cellLabel?: string;
  code: string;
  passed: boolean;
  isFinalStep: boolean;
  error?: string | null;
  checkpointResults?: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
  tests?: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
};

type WrongQuestionRecord = {
  id: string;
  ts: string;
  courseId: string;
  courseTitle: string;
  questionId: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
};

type ChallengeAttemptRecord = {
  id: string;
  ts: string;
  courseId: string;
  courseTitle: string;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
};

type LabRecordsState = {
  exerciseRuns: ExerciseRunRecord[];
  wrongQuestions: WrongQuestionRecord[];
  challengeAttempts: ChallengeAttemptRecord[];
};

const PROGRESS_KEY = 'python_lab_v4_progress';
const RECORDS_KEY = 'python_lab_v4_records';

const emptyProgress: ProgressState = {
  completed: [],
  score: 0,
  badges: [],
  quality: {},
};

const emptyRecords: LabRecordsState = {
  exerciseRuns: [],
  wrongQuestions: [],
  challengeAttempts: [],
};

const getAuthHeader = () => {
    const token = localStorage.getItem('statlab_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const readProgress = (): ProgressState => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY) || localStorage.getItem('python_lab_v3_progress') || localStorage.getItem('python_lab_v2_progress');
    if (!raw) return emptyProgress;
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      score: Number(parsed.score || 0),
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      quality: parsed.quality || {},
    };
  } catch {
    return emptyProgress;
  }
};

const readRecords = (): LabRecordsState => {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return emptyRecords;
    const parsed = JSON.parse(raw);
    return {
      exerciseRuns: Array.isArray(parsed.exerciseRuns) ? parsed.exerciseRuns : [],
      wrongQuestions: Array.isArray(parsed.wrongQuestions) ? parsed.wrongQuestions : [],
      challengeAttempts: Array.isArray(parsed.challengeAttempts) ? parsed.challengeAttempts : [],
    };
  } catch {
    return emptyRecords;
  }
};

function statusTag(status: string) {
  if (status === 'passed') return { label: '已通过', color: '#0891b2', bg: '#ecfeff' };
  if (status === 'partial') return { label: '部分完成', color: '#0891b2', bg: '#ecfeff' };
  if (status === 'failed') return { label: '未通过', color: '#dc2626', bg: '#fef2f2' };
  return { label: '待提交', color: '#64748b', bg: '#f1f5f9' };
}

const StatCard: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, marginBottom: 4 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{value}</div>
  </div>
);

const BadgeItem: React.FC<{ name: string; date?: string; locked?: boolean; icon: React.ReactNode; color: string }> = ({ name, date, locked, icon, color }) => (
  <div style={{ textAlign: 'center', opacity: locked ? 0.4 : 1 }}>
    <div style={{ 
      width: 72, height: 72, margin: '0 auto 10px', borderRadius: 18, 
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      boxShadow: locked ? 'none' : '0 8px 16px -4px rgba(0,0,0,0.1)',
      position: 'relative', border: locked ? '2px dashed #e2e8f0' : 'none'
    }}>
      {icon}
      {locked && <Lock size={14} style={{ position: 'absolute', bottom: -4, right: -4, color: '#94a3b8', background: '#fff', borderRadius: '50%', padding: 2 }} />}
    </div>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{name}</div>
    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{locked ? 'Locked' : `Unlocked ${date}`}</div>
  </div>
);

const FeedbackModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  code?: string;
  error?: string;
  checkpoints: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
  wrongQuestions: WrongQuestionRecord[];
}> = ({ open, onClose, title, code, error, checkpoints, wrongQuestions }) => {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title={title}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: 10, borderRadius: 8, background: error ? '#fef2f2' : '#f0fdf4', color: error ? '#991b1b' : '#166534', fontSize: 13 }}>
          {error ? `执行出错: ${error}` : '运行成功'}
        </div>

        {code && (
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>代码提交</div>
            <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: '#0f172a', color: '#86efac', overflow: 'auto', fontSize: 12 }}>{code}</pre>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>检查点详情</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {checkpoints.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无检查点记录</div>}
            {checkpoints.map((x, i) => (
              <div key={`${x.name}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: x.status === 'passed' ? '#166534' : '#991b1b' }}>
                {x.status === 'passed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>{x.name}{x.status === 'failed' && x.message ? `: ${x.message}` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>错题回顾 (Challenge 模式)</div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
            {wrongQuestions.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无错题</div>}
            {wrongQuestions.map((w) => (
              <div key={w.id} style={{ border: '1px solid #fee2e2', borderRadius: 8, padding: 10, background: '#fff' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{w.question}</div>
                <div style={{ fontSize: 12, color: '#991b1b' }}>你的选项: {w.selectedAnswer || '(空)'}</div>
                <div style={{ fontSize: 12, color: '#166534' }}>正确答案: {w.correctAnswer || '(空)'}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>解析: {w.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const LabPortal: React.FC<LabPortalProps> = ({ initialTab = 'notebooks', onGoToCourse }) => {
  const [activeTab, setActiveTab] = useState<LabTab>(initialTab);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [records, setRecords] = useState<LabRecordsState>(emptyRecords);
  const [feedbackCourseId, setFeedbackCourseId] = useState<string | null>(null);

  useEffect(() => {
    const loadFromBackend = async () => {
        const localProg = readProgress();
        const localRecs = readRecords();

        try {
            const [progRes, recRes] = await Promise.all([
                fetch('/api/learning/progress', { headers: getAuthHeader() }),
                fetch('/api/learning/records', { headers: getAuthHeader() })
            ]);
            
            if (progRes.ok) {
                const remoteProg = await progRes.json();
                // Strategy: Merge quality and completed stages
                const mergedProg: ProgressState = {
                    ...remoteProg,
                    completed: Array.from(new Set([...(remoteProg.completed || []), ...(localProg.completed || [])])),
                    score: Math.max(remoteProg.score || 0, localProg.score || 0),
                    quality: { ...(remoteProg.quality || {}), ...(localProg.quality || {}) }
                };
                setProgress(mergedProg);
                localStorage.setItem(PROGRESS_KEY, JSON.stringify(mergedProg));
            } else {
                setProgress(localProg);
            }

            if (recRes.ok) {
                const remoteRecs = await recRes.json() as LabRecordsState;
                
                const mergeById = <T extends { id: string }>(remote: T[], local: T[]): T[] => {
                    const map = new Map<string, T>();
                    // Local records are usually more recent or haven't been synced yet
                    remote.forEach(r => map.set(r.id, r));
                    local.forEach(l => map.set(l.id, l));
                    return Array.from(map.values()).sort((a, b) => (b as any).ts?.localeCompare((a as any).ts) || 0);
                };

                const mergedRecs: LabRecordsState = {
                    exerciseRuns: mergeById(remoteRecs.exerciseRuns || [], localRecs.exerciseRuns),
                    wrongQuestions: mergeById(remoteRecs.wrongQuestions || [], localRecs.wrongQuestions),
                    challengeAttempts: mergeById(remoteRecs.challengeAttempts || [], localRecs.challengeAttempts),
                };
                
                setRecords(mergedRecs);
                localStorage.setItem(RECORDS_KEY, JSON.stringify(mergedRecs));
            } else {
                setRecords(localRecs);
            }
        } catch (err) {
            console.warn("LabPortal: Failed to fetch from backend, using local storage", err);
            setProgress(localProg);
            setRecords(localRecs);
        }
    };

    void loadFromBackend();
  }, []);

  const notebooks = useMemo(() => {
    return LAB_COURSES.map((course, idx) => {
      const done = progress.completed.includes(course.id);
      const q = progress.quality?.[course.id];
      const inProgress = !done && ((q?.attempts || 0) > 0 || records.exerciseRuns.some((x) => x.courseId === course.id));
      const prev = idx === 0 ? null : LAB_COURSES[idx - 1];
      const prevPassed = idx === 0 ? true : Boolean(progress.quality?.[prev!.id]?.challengePassed);
      const locked = !done && !inProgress && !prevPassed;
      return { course, done, inProgress: inProgress || prevPassed, locked };
    });
  }, [progress, records.exerciseRuns]);

  const assignments = useMemo(() => {
    return LAB_COURSES.map((course) => {
      const runs = records.exerciseRuns.filter((x) => x.courseId === course.id).sort((a, b) => a.ts.localeCompare(b.ts));
      const latest = runs[runs.length - 1];
      const hasFinalPass = runs.some((r) => r.isFinalStep && r.passed && !(r.tests || []).some((t) => t.status === 'failed'));
      const hasAnyPass = runs.some((r) => r.passed);
      const status: 'pending' | 'passed' | 'partial' | 'failed' = hasFinalPass ? 'passed' : (runs.length === 0 ? 'pending' : (hasAnyPass ? 'partial' : 'failed'));
      const wrong = records.wrongQuestions.filter((w) => w.courseId === course.id);
      return { course, runs, latest, status, wrong };
    });
  }, [records]);

  const achievements = useMemo(() => {
    return LAB_COURSES
      .map((course) => {
        const q = progress.quality?.[course.id];
        const best = q?.challengeBestScore || 0;
        const retries = q?.retries || 0;
        const efficiency = retries === 0 ? 'A+' : retries <= 2 ? 'A' : retries <= 5 ? 'B' : 'C';
        const passRecord = records.challengeAttempts.find(a => a.courseId === course.id && a.passed);
        const unlocked = !!passRecord || progress.completed.includes(course.id);
        const next = LAB_COURSES.find((x) => x.stage === course.stage + 1);
        return {
          course,
          best,
          efficiency,
          unlocked,
          date: passRecord ? new Date(passRecord.ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) : undefined,
          nextCourseId: next?.id,
        };
      });
  }, [progress, records.challengeAttempts]);

  const activityLog = useMemo(() => {
    const logs: Array<{ id: string; type: 'completion' | 'run' | 'badge'; text: string; time: string; ts: number }> = [];
    
    // Challenge passes
    records.challengeAttempts.filter(a => a.passed).forEach((a, i) => {
      const course = LAB_COURSES.find(c => c.id === a.courseId);
      logs.push({
        id: `comp_${a.id}`,
        type: 'completion',
        text: `你通过了第 ${course?.stage || '?'} 课挑战：${course?.title || '未知'}！`,
        time: new Date(a.ts).toLocaleDateString(),
        ts: new Date(a.ts).getTime()
      });
      logs.push({
        id: `badge_${a.id}`,
        type: 'badge',
        text: `你获得了“${course?.title || '未知'}”勋章！`,
        time: new Date(a.ts).toLocaleDateString(),
        ts: new Date(a.ts).getTime()
      });
    });

    // Recent exercise runs
    records.exerciseRuns.slice(-5).forEach((r, i) => {
      const course = LAB_COURSES.find(c => c.id === r.courseId);
      logs.push({
        id: `run_${i}_${r.ts}`,
        type: 'run',
        text: `在“${course?.title || '未知课程'}”中提交了代码`,
        time: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ts: new Date(r.ts).getTime()
      });
    });

    return logs.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [records]);

  const feedbackData = useMemo(() => {
    if (!feedbackCourseId) return null;
    const ass = assignments.find((x) => x.course.id === feedbackCourseId);
    if (!ass) return null;
    return {
      title: `${ass.course.chapter} · ${ass.course.title}`,
      code: ass.latest?.code,
      error: ass.latest?.error || undefined,
      checkpoints: ass.latest?.checkpointResults || [],
      wrongQuestions: ass.wrong,
    };
  }, [feedbackCourseId, assignments]);

  const tabMeta = [
    { id: 'notebooks' as LabTab, label: '学习笔记', icon: <BookOpen size={15} /> },
    { id: 'assignments' as LabTab, label: '作业反馈', icon: <FileText size={15} /> },
    { id: 'achievements' as LabTab, label: '我的成果', icon: <Trophy size={15} /> },
  ];

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 28px' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {tabMeta.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.id ? '#2563eb' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '14px 2px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          {activeTab === 'notebooks' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>学习笔记 (Learning Notes)</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>同步课程核心知识点，支持在线运行示例代码。</p>
              </div>
              {notebooks.map(({ course, done, inProgress, locked }) => {
                const tag = statusTag(done ? 'passed' : inProgress ? 'partial' : 'pending');
                return (
                  <div key={course.id} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: locked ? 0.55 : 1, transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: locked ? '#f1f5f9' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? '#94a3b8' : '#2563eb' }}>
                        {locked ? <Lock size={18} /> : <BookOpen size={18} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, color: '#1e293b' }}>{course.stage}. {course.title}</span>
                          <span style={{ background: tag.bg, color: tag.color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{tag.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{course.objective}</div>
                      </div>
                    </div>
                    <button
                      disabled={locked}
                      onClick={() => onGoToCourse(course.id)}
                      style={{ border: 'none', background: locked ? '#f1f5f9' : '#2563eb', color: locked ? '#94a3b8' : '#fff', borderRadius: 8, padding: '8px 16px', cursor: locked ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}
                    >
                      {done ? '复习' : '开始'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {/* Sidebar (Left) */}
              <div style={{ width: 240, position: 'sticky', top: 0, display: 'grid', gap: 16 }}>
                <div style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Course Progress</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                    <span>Overall Mastery</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>{Math.round((progress.completed.length / LAB_COURSES.length) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(progress.completed.length / LAB_COURSES.length) * 100}%`, height: '100%', background: '#2563eb' }} />
                  </div>
                  <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                      <CheckCircle size={14} color="#16a34a" /> <b>{progress.completed.length}</b> Lessons Completed
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
                      <FileText size={14} color="#2563eb" /> <b>{assignments.filter(a => a.status === 'pending').length}</b> Assignments Pending
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: '1px solid #f1f5f9', fontSize: 11, color: '#64748b' }}>
                  Need help with Machine Learning concepts? Join the <b>Community Slack</b> for 24/7 support.
                </div>
              </div>

              {/* Main Content (Right) */}
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>作业反馈 (Assignment Feedback)</h1>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>查看代码执行结果并持续优化模型。</p>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  {assignments.map((a) => {
                    const tag = statusTag(a.status);
                    const latestCode = a.latest?.code?.slice(0, 320) || '';
                    const isPending = a.status === 'pending';

                    return (
                      <div key={a.course.id} style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', padding: 24, position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ position: 'absolute', top: 24, right: 24 }}>
                          <span style={{ background: tag.bg, color: tag.color, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {tag.label}
                          </span>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Lesson {a.course.stage}: {a.course.title}</h2>
                          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={14} /> {a.runs.length} 次运行</span>
                            {a.wrong.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 700 }}><XCircle size={14} /> {a.wrong.length} 个选择题错误</span>}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #f1f5f9', marginBottom: 20, position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>main.py</span>
                            <button style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', color: '#94a3b8' }}><Copy size={13} /></button>
                          </div>
                          {latestCode ? (
                            <pre style={{ margin: 0, color: '#334155', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', lineHeight: 1.6, overflow: 'hidden' }}>
                              {latestCode}
                              {a.latest?.code && a.latest.code.length > 320 && '...'}
                            </pre>
                          ) : (
                            <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', padding: '10px 0' }}># Project structure initialized\n# Waiting for first code execution...</div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => onGoToCourse(a.course.id)}
                              style={{ border: 'none', background: isPending ? '#e2e8f0' : '#2563eb', color: isPending ? '#475569' : '#fff', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                            >
                              {isPending ? 'Start Assignment' : 'Continue Practice'}
                            </button>
                            <button
                              onClick={() => !isPending && setFeedbackCourseId(a.course.id)}
                              style={{ border: 'none', background: 'transparent', color: '#2563eb', padding: '10px 12px', cursor: isPending ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, opacity: isPending ? 0.5 : 1 }}
                            >
                              {isPending ? '课程说明' : (a.wrong.length > 0 ? '查看详情 & 错题' : '查看详情')}
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Last updated {a.latest?.ts ? new Date(a.latest.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div style={{ display: 'grid', gap: 24 }}>
              {/* Header with XP Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>我的成果 (My Achievements)</h1>
                  <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 15, maxWidth: 500, lineHeight: 1.5 }}>
                    掌握 Python 编程精要。记录从初学者到数据专家的每一步成长。
                  </p>
                </div>
                <div style={{ background: '#fff', padding: '16px 24px', borderRadius: 16, border: '1px solid #f1f5f9', width: 280 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>等级 {Math.floor(progress.score / 1000) || 1} 架构师</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{(progress.score % 1000).toLocaleString()} / 1,000 XP</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(progress.score % 1000) / 10}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #2563eb)', borderRadius: 4 }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                {/* Left Section: Badge Collection */}
                <div style={{ flex: 1, display: 'grid', gap: 24 }}>
                  <div style={{ background: '#f8fafc', padding: 32, borderRadius: 24, border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>勋章馆 (Badge Collection)</h2>
                      <div style={{ display: 'flex', background: '#e2e8f0', padding: 4, borderRadius: 10, gap: 4 }}>
                        <button style={{ border: 'none', background: '#fff', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>全部</button>
                        <button style={{ border: 'none', background: 'transparent', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>已获得</button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
                      {achievements.map((ach) => (
                        <BadgeItem 
                          key={ach.course.id}
                          name={ach.course.title} 
                          date={ach.date} 
                          locked={!ach.unlocked} 
                          icon={ach.course.stage <= 2 ? <Play size={24} /> : ach.course.stage <= 4 ? <Target size={24} /> : <Zap size={24} />} 
                          color={ach.unlocked ? (ach.course.stage <= 2 ? '#f59e0b' : ach.course.stage <= 4 ? '#4338ca' : '#7c3aed') : '#f1f5f9'} 
                        />
                      ))}
                    </div>
                  </div>

                  {/* Current Quest Card */}
                  {notebooks.find(n => !n.done) && (
                    <div style={{ background: '#09090b', color: '#fff', borderRadius: 24, padding: 40, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'relative', zIndex: 10, maxWidth: 360 }}>
                        <span style={{ background: '#2563eb', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>当前挑战</span>
                        <h2 style={{ fontSize: 28, margin: '16px 0 8px', fontWeight: 800 }}>{notebooks.find(n => !n.done)?.course.title}</h2>
                        <p style={{ margin: 0, fontSize: 15, color: '#a1a1aa', lineHeight: 1.6 }}>完成 “{notebooks.find(n => !n.done)?.course.chapter}” 模块的学习，即可获得对应的勋章和积分奖励。</p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                          <button onClick={() => onGoToCourse(notebooks.find(n => !n.done)!.course.id)} style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>继续课程</button>
                          <button onClick={() => setActiveTab('notebooks')} style={{ background: 'transparent', color: '#fff', border: '1px solid #3f3f46', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>查看笔记</button>
                        </div>
                      </div>
                      <div style={{ position: 'absolute', right: -40, bottom: -20, opacity: 0.2, transform: 'rotate(-15deg)' }}>
                        <Play size={240} style={{ color: '#fff' }} fill="currentColor" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Section: Activity & Stats */}
                <div style={{ width: 320, display: 'grid', gap: 24 }}>
                  {/* Recent Activity */}
                  <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #f1f5f9' }}>
                    <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>近期活动 (Activity)</h2>
                    <div style={{ display: 'grid', gap: 20 }}>
                      {activityLog.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>暂无近期活动记录...</div>}
                      {activityLog.map((log) => (
                        <div key={log.id} style={{ display: 'flex', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: log.type === 'completion' ? '#ecfeff' : log.type === 'badge' ? '#fef2f2' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: log.type === 'completion' ? '#0891b2' : log.type === 'badge' ? '#dc2626' : '#7c3aed' }}>
                            {log.type === 'completion' ? <CheckCircle size={16} /> : log.type === 'badge' ? <Award size={16} /> : <FileText size={16} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{log.text}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{log.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mastery Stats */}
                  <div style={{ background: '#fff', padding: 24, borderRadius: 20, border: '1px solid #f1f5f9' }}>
                    <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>技能统计 (Mastery)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <StatCard label="已修课程" value={progress.completed.length} />
                      <StatCard label="练习次数" value={records.exerciseRuns.length} />
                      <StatCard label="全站排名" value={`#${Math.max(1, 1054 - Math.floor(progress.score / 100))}`} />
                      <StatCard label="总积分" value={`${(progress.score / 1000).toFixed(1)}k`} />
                    </div>
                  </div>

                  {/* Unlock Promo */}
                  <div style={{ background: '#000', borderRadius: 20, overflow: 'hidden', color: '#fff' }}>
                    <img src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80\u0026w=600\u0026auto=format\u0026fit=crop" alt="Deep Learning" style={{ width: '100%', height: 160, objectFit: 'cover', opacity: 0.7 }} />
                    <div style={{ padding: 20 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>解锁高级深度学习课程</div>
                      <div style={{ fontSize: 11, color: '#a1a1aa' }}>完成当前路径即可开启 Elite 实验室。</div>
                      <button style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, marginTop: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        立即升级 <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FeedbackModal
        open={Boolean(feedbackData)}
        onClose={() => setFeedbackCourseId(null)}
        title={feedbackData?.title || ''}
        code={feedbackData?.code}
        error={feedbackData?.error}
        checkpoints={feedbackData?.checkpoints || []}
        wrongQuestions={feedbackData?.wrongQuestions || []}
      />
    </div>
  );
};

export default LabPortal;
