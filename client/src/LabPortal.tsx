import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { Award, BookOpen, CheckCircle, ChevronRight, FileText, Lock, Play, RefreshCcw, Star, Trophy, XCircle } from 'lucide-react';
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

function statusTag(passed: boolean, inProgress: boolean) {
  if (passed) return { label: '???', color: '#16a34a', bg: '#f0fdf4' };
  if (inProgress) return { label: '???', color: '#2563eb', bg: '#eff6ff' };
  return { label: '???', color: '#94a3b8', bg: '#f8fafc' };
}

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
          {error ? `??????: ${error}` : '????????'}
        </div>

        {code && (
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>??????</div>
            <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: '#0f172a', color: '#86efac', overflow: 'auto', fontSize: 12 }}>{code}</pre>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Checkpoint ??</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {checkpoints.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>?? checkpoint ??</div>}
            {checkpoints.map((x, i) => (
              <div key={`${x.name}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: x.status === 'passed' ? '#166534' : '#991b1b' }}>
                {x.status === 'passed' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                <span>{x.name}{x.status === 'failed' && x.message ? `: ${x.message}` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>?????Challenge?</div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
            {wrongQuestions.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>????</div>}
            {wrongQuestions.map((w) => (
              <div key={w.id} style={{ border: '1px solid #fee2e2', borderRadius: 8, padding: 10, background: '#fff' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{w.question}</div>
                <div style={{ fontSize: 12, color: '#991b1b' }}>????: {w.selectedAnswer || '(?)'}</div>
                <div style={{ fontSize: 12, color: '#166534' }}>????: {w.correctAnswer || '(?)'}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>??: {w.explanation}</div>
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
    const sync = () => {
      setProgress(readProgress());
      setRecords(readRecords());
    };
    sync();

    const timer = window.setInterval(sync, 1200);
    const onStorage = () => sync();
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
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
      .filter((c) => progress.completed.includes(c.id))
      .map((course) => {
        const q = progress.quality?.[course.id];
        const best = q?.challengeBestScore || 0;
        const retries = q?.retries || 0;
        const efficiency = retries === 0 ? 'A+' : retries <= 2 ? 'A' : retries <= 5 ? 'B' : 'C';
        const next = LAB_COURSES.find((x) => x.stage === course.stage + 1);
        return {
          course,
          best,
          efficiency,
          nextCourseId: next?.id,
        };
      })
      .sort((a, b) => a.course.stage - b.course.stage);
  }, [progress]);

  const feedbackData = useMemo(() => {
    if (!feedbackCourseId) return null;
    const ass = assignments.find((x) => x.course.id === feedbackCourseId);
    if (!ass) return null;
    return {
      title: `${ass.course.chapter} ? ${ass.course.title}`,
      code: ass.latest?.code,
      error: ass.latest?.error || undefined,
      checkpoints: ass.latest?.checkpointResults || [],
      wrongQuestions: ass.wrong,
    };
  }, [feedbackCourseId, assignments]);

  const tabMeta = [
    { id: 'notebooks' as LabTab, label: '????', icon: <BookOpen size={15} /> },
    { id: 'assignments' as LabTab, label: '?? & ??', icon: <FileText size={15} /> },
    { id: 'achievements' as LabTab, label: '????', icon: <Trophy size={15} /> },
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
            <div style={{ display: 'grid', gap: 10 }}>
              {notebooks.map(({ course, done, inProgress, locked }) => {
                const tag = statusTag(done, inProgress);
                return (
                  <div key={course.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: locked ? 0.55 : 1 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b>{course.stage}. {course.title}</b>
                        <span style={{ background: tag.bg, color: tag.color, borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>{tag.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{course.objective}</div>
                    </div>
                    <button
                      disabled={locked}
                      onClick={() => onGoToCourse(course.id)}
                      style={{ border: '1px solid #dbeafe', background: locked ? '#f8fafc' : '#eff6ff', color: locked ? '#94a3b8' : '#1d4ed8', borderRadius: 8, padding: '8px 12px', cursor: locked ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                    >
                      {done ? '??' : '??'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {assignments.map((a) => {
                const color = a.status === 'passed' ? '#16a34a' : a.status === 'partial' ? '#d97706' : a.status === 'failed' ? '#dc2626' : '#94a3b8';
                const label = a.status === 'passed' ? '???' : a.status === 'partial' ? '????' : a.status === 'failed' ? '???' : '???';
                const latestCode = a.latest?.code?.slice(0, 240) || '';
                return (
                  <div key={a.course.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.course.chapter} ? {a.course.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>???? {a.runs.length} ? ? ?? {a.wrong.length} ?</div>
                      </div>
                      <span style={{ fontSize: 12, color, fontWeight: 700 }}>{label}</span>
                    </div>

                    {latestCode && (
                      <pre style={{ margin: '8px 0', background: '#0f172a', color: '#86efac', borderRadius: 8, padding: 10, fontSize: 12, overflow: 'auto' }}>{latestCode}</pre>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onGoToCourse(a.course.id)}
                        style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Play size={13} /> ????
                      </button>
                      <button
                        onClick={() => setFeedbackCourseId(a.course.id)}
                        style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <RefreshCcw size={13} /> ????
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'achievements' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <Award size={18} color="#2563eb" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{progress.badges.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Badges</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <Star size={18} color="#f59e0b" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{progress.score}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Points</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <Trophy size={18} color="#16a34a" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{achievements.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>????</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {achievements.length === 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, color: '#64748b' }}>
                    ???????? Challenge ??????????
                  </div>
                )}
                {achievements.map((a) => (
                  <div key={a.course.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.course.chapter} ? {a.course.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>?????: {a.best} ? ????: {a.efficiency}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {a.course.skills.slice(0, 5).map((s, i) => <span key={i} style={{ fontSize: 11, background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '2px 6px' }}>{s}</span>)}
                      </div>
                    </div>
                    <button
                      onClick={() => onGoToCourse(a.nextCourseId || a.course.id)}
                      style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      ?? <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
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
