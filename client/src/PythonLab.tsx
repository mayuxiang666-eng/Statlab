import React, { useEffect, useMemo, useState } from 'react';
import { message, Modal, Spin, Tag } from 'antd';
import { AlertTriangle, Award, BookOpen, CheckCircle, ChevronLeft, Code2, Play, Trophy, Zap } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LAB_COURSES, LabCourse, NotebookCell, QuizQuestion } from './CourseData';

const API_BASE = '/api';
const CHALLENGE_PASS_SCORE = 80;

type CellWithState = NotebookCell & {
  running?: boolean;
  output?: RunOutput;
};

type RunOutput = {
  logs: string[];
  plots: string[];
  tests: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
  checkpointResults?: Array<{ name: string; status: 'passed' | 'failed'; message?: string }>;
  success: boolean;
  error?: string | null;
  envStatus?: { healthy: boolean; message: string; dependencies?: Record<string, boolean> };
  datasetStatus?: { required: boolean; available: boolean; rows: number; columns: string[]; message: string };
  nextRecommendedAction?: string;
  placeholderStatus?: { hasUnfilled: boolean; missingCount: number };
  lineHints?: string[];
};

type LabMode = 'tutorial' | 'exercise' | 'challenge';

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


type QuizAnswerState = Record<string, string>;
type QuizCheckState = Record<string, { checked: boolean; correct: boolean }>;

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

const LAB_PROGRESS_KEY = 'python_lab_v4_progress';
const LAB_RECORDS_KEY = 'python_lab_v4_records';
const MAX_EXERCISE_RECORDS = 300;
const MAX_WRONG_RECORDS = 300;
const MAX_CHALLENGE_RECORDS = 120;

const readLabRecords = (): LabRecordsState => {
  try {
    const raw = localStorage.getItem(LAB_RECORDS_KEY);
    if (!raw) return { exerciseRuns: [], wrongQuestions: [], challengeAttempts: [] };
    const parsed = JSON.parse(raw);
    return {
      exerciseRuns: Array.isArray(parsed.exerciseRuns) ? parsed.exerciseRuns : [],
      wrongQuestions: Array.isArray(parsed.wrongQuestions) ? parsed.wrongQuestions : [],
      challengeAttempts: Array.isArray(parsed.challengeAttempts) ? parsed.challengeAttempts : [],
    };
  } catch {
    return { exerciseRuns: [], wrongQuestions: [], challengeAttempts: [] };
  }
};

const writeLabRecords = (next: LabRecordsState) => {
  localStorage.setItem(LAB_RECORDS_KEY, JSON.stringify(next));
};

const defaultQuality = (): QualityState => ({
  attempts: 0,
  retries: 0,
  firstPass: true,
  passedCheckpoints: 0,
  challengeAttempts: 0,
  challengeBestScore: 0,
  challengePassed: false,
});

const PLACEHOLDER_PATTERN = /(____|TODO)/g;

const findPlaceholderHints = (code: string): string[] => {
  const lines = code.split('\n');
  const hints: string[] = [];
  lines.forEach((line, idx) => {
    if (PLACEHOLDER_PATTERN.test(line)) hints.push(`Line ${idx + 1}: ${line.trim()}`);
    PLACEHOLDER_PATTERN.lastIndex = 0;
  });
  return hints;
};

const translateError = (errText: string) => {
  if (!errText) return { title: 'Unknown error', cause: '', fix: '' };
  if (errText.includes('Python ML')) {
    return {
      title: 'Python service unavailable',
      cause: 'Backend could not connect to Python runtime service.',
      fix: 'Start Python service via `npm run python:dev`.',
    };
  }
  if (errText.includes('KeyError')) {
    return { title: 'Column not found', cause: 'A referenced field does not exist in current dataset.', fix: 'Run `print(df.columns.tolist())` to verify column names.' };
  }
  if (errText.includes('NameError')) {
    return { title: 'Variable not defined', cause: 'A variable is used before assignment.', fix: 'Run cells from top to bottom and ensure prerequisites are executed.' };
  }
  if (errText.includes('ModuleNotFoundError')) {
    return { title: 'Dependency missing', cause: 'Python environment is missing required package(s).', fix: 'Run `npm run python:install`.' };
  }
  if (errText.includes('Incomplete code')) {
    return { title: 'Fill-in required', cause: 'This step still has placeholders like ____ or TODO.', fix: 'Fill all placeholders, then run this step again.' };
  }
  return { title: 'Execution failed', cause: 'Check traceback for exact line and exception.', fix: 'Fix the first error and rerun current step.' };
};

const OutputArea: React.FC<{ output?: RunOutput; running?: boolean }> = ({ output, running }) => {
  if (running) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: '#f8fafc' }}>
        <Spin size="small" />
        <span style={{ fontSize: 13, color: '#64748b' }}>Kernel executing...</span>
      </div>
    );
  }

  if (!output) return null;

  if (output.error) {
    const e = translateError(output.error);
    return (
      <div style={{ padding: '12px 20px', background: '#fff' }}>
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '0 8px 8px 0', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={14} color="#dc2626" />
            <b style={{ color: '#dc2626', fontSize: 13 }}>{e.title}</b>
          </div>
          <div style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 4 }}>{e.cause}</div>
          <div style={{ fontSize: 12, color: '#1d4ed8' }}>Suggested fix: {e.fix}</div>
          {!!output.lineHints?.length && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d' }}>
              {output.lineHints.map((h, i) => <div key={i}>{h}</div>)}
            </div>
          )}
          {output.nextRecommendedAction && <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>Next action: {output.nextRecommendedAction}</div>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>Traceback</summary>
            <pre style={{ marginTop: 6, padding: 8, background: '#111827', color: '#fca5a5', fontSize: 11, whiteSpace: 'pre-wrap', borderRadius: 6 }}>{output.error}</pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderTop: '1px solid #edf2f7' }}>
      {output.envStatus && (
        <div style={{ padding: '10px 20px', fontSize: 12, background: output.envStatus.healthy ? '#ecfeff' : '#fef2f2', color: output.envStatus.healthy ? '#155e75' : '#991b1b' }}>
          Environment: {output.envStatus.message}
        </div>
      )}
      {output.datasetStatus && (
        <div style={{ padding: '10px 20px', fontSize: 12, background: '#f8fafc', color: '#334155' }}>
          Dataset: {output.datasetStatus.message} · rows {output.datasetStatus.rows}
        </div>
      )}
      {output.logs?.length > 0 && (
        <div style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#1e293b', background: '#f8fafc' }}>
          {output.logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {!!output.checkpointResults?.length && (
        <div style={{ padding: '10px 20px', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>Checkpoint results</div>
          {output.checkpointResults.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.status === 'passed' ? '#166534' : '#991b1b' }}>
              {t.status === 'passed' ? <CheckCircle size={13} color="#16a34a" /> : <AlertTriangle size={13} color="#dc2626" />}
              <span>{t.status === 'passed' ? `${t.name} passed` : `${t.name} failed: ${t.message || ''}`}</span>
            </div>
          ))}
        </div>
      )}
      {!!output.tests?.length && (
        <div style={{ padding: '10px 20px', background: '#f0fdf4' }}>
          <div style={{ fontSize: 12, color: '#14532d', marginBottom: 6 }}>Final tests</div>
          {output.tests.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.status === 'passed' ? '#166534' : '#991b1b' }}>
              {t.status === 'passed' ? <CheckCircle size={13} color="#16a34a" /> : <AlertTriangle size={13} color="#dc2626" />}
              <span>{t.status === 'passed' ? `${t.name} passed` : `${t.name} failed: ${t.message || ''}`}</span>
            </div>
          ))}
        </div>
      )}
      {output.plots?.length > 0 && (
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          {output.plots.map((p, i) => <img key={i} src={`data:image/png;base64,${p}`} alt={`plot-${i}`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />)}
        </div>
      )}
    </div>
  );
};

const NotebookCellView: React.FC<{
  cell: CellWithState;
  index: number;
  onRun?: () => void;
  onUpdate?: (content: string) => void;
  runDisabled?: boolean;
  showPromptCard?: boolean;
  allowRunWhenLocked?: boolean;
}> = ({ cell, index, onRun, onUpdate, runDisabled, showPromptCard, allowRunWhenLocked }) => {
  const isCode = cell.type === 'code';
  const isLocked = cell.isLocked;

  if (!isCode) {
    return (
      <div style={{ padding: '20px 0', maxWidth: 900, margin: '0 auto' }}>
        <div className="markdown-body" style={{ fontSize: 16, lineHeight: 1.8, color: '#2d3748' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '20px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      <div style={{ height: 48, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #edf2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>In [{index + 1}]</div>
          {cell.label && <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{cell.label}</span>}
          {isLocked && <Tag color="default" style={{ margin: 0 }}>READ-ONLY</Tag>}
          {cell.difficultyTag && <Tag color={cell.difficultyTag === 'warmup' ? 'blue' : cell.difficultyTag === 'core' ? 'gold' : 'purple'} style={{ margin: 0 }}>{cell.difficultyTag.toUpperCase()}</Tag>}
        </div>
        {(!isLocked || allowRunWhenLocked) && (
          <button
            onClick={onRun}
            disabled={cell.running || runDisabled}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: runDisabled ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: runDisabled ? 'not-allowed' : 'pointer' }}
          >
            {cell.running ? <Spin size="small" /> : <Play size={12} fill="currentColor" />}Run
          </button>
        )}
      </div>
      {showPromptCard && cell.prompt && (
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #edf2f7' }}>
          <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 700, marginBottom: 6 }}>Step Prompt</div>
          <div style={{ fontSize: 13, color: '#334155' }}>{cell.prompt}</div>
          {cell.requiresFill && <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 6 }}>Fill all `____` or `TODO`, then run this step.</div>}
          {cell.checkAlias && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Check alias: {cell.checkAlias}</div>}
          {cell.referenceSolution && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, color: '#475569', cursor: 'pointer' }}>View reference solution (optional)</summary>
              <pre style={{ marginTop: 8, padding: 10, background: '#0f172a', color: '#86efac', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{cell.referenceSolution}</pre>
            </details>
          )}
        </div>
      )}
      <div style={{ display: 'flex' }}>
        <div style={{ width: 48, background: '#f1f5f9', borderRight: '1px solid #edf2f7', padding: '20px 0', textAlign: 'right', userSelect: 'none' }}>
          {cell.content.split('\n').map((_, i) => <div key={i} style={{ paddingRight: 12, fontSize: 12, color: '#94a3b8', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>{i + 1}</div>)}
        </div>
        {isLocked ? (
          <pre style={{ flex: 1, margin: 0, padding: '20px 24px', background: '#fff', fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.7, color: '#1e293b', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{cell.content}</pre>
        ) : (
          <textarea
            value={cell.content}
            onChange={(e) => onUpdate?.(e.target.value)}
            spellCheck={false}
            style={{ flex: 1, border: 'none', outline: 'none', padding: '20px 24px', background: '#fff', fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.7, color: '#1e293b', minHeight: 150, resize: 'vertical' }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun?.(); }
            }}
          />
        )}
      </div>
      {(cell.output || cell.running) && <OutputArea output={cell.output} running={!!cell.running} />}
    </div>
  );
};

const PythonLab: React.FC<{ initialCourseId?: string }> = ({ initialCourseId }) => {
  const [selectedCourse, setSelectedCourse] = useState<LabCourse | null>(null);
  const [activeMode, setActiveMode] = useState<LabMode | null>(null);
  const [cells, setCells] = useState<CellWithState[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [quality, setQuality] = useState<Record<string, QualityState>>({});
  const [health, setHealth] = useState<any>({ loading: true, data: null });
  const [successModal, setSuccessModal] = useState<{ visible: boolean; course?: LabCourse; challengeScore?: number }>({ visible: false });
  const [challengeModal, setChallengeModal] = useState<{ visible: boolean; score: number; required: number }>({ visible: false, score: 0, required: CHALLENGE_PASS_SCORE });
  const [challengeAnswers, setChallengeAnswers] = useState<QuizAnswerState>({});
  const [challengeChecks, setChallengeChecks] = useState<QuizCheckState>({});
  const [challengeStepIndex, setChallengeStepIndex] = useState(0);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LAB_PROGRESS_KEY) || localStorage.getItem('python_lab_v3_progress') || localStorage.getItem('python_lab_v2_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompletedStages(new Set(parsed.completed || []));
        setScore(parsed.score || 0);
        setBadges(parsed.badges || []);
        setQuality(parsed.quality || {});
      } catch {
        // ignore
      }
    }
    void fetchDatasets();
    void fetchHealth();
  }, []);

  useEffect(() => {
    if (!initialCourseId) return;
    const c = LAB_COURSES.find((x) => x.id === initialCourseId);
    if (c) void loadCourse(c, 'tutorial');
  }, [initialCourseId, datasets.length]);

  const datasetVersionOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];
    for (const ds of datasets) {
      for (const v of ds.versions || []) options.push({ id: String(v.id), label: `${ds.name} · v${v.version}` });
    }
    return options;
  }, [datasets]);

  const persistProgress = (next: ProgressState) => {
    localStorage.setItem(LAB_PROGRESS_KEY, JSON.stringify(next));
  };


  const appendExerciseRecord = (record: ExerciseRunRecord) => {
    const curr = readLabRecords();
    const next: LabRecordsState = {
      ...curr,
      exerciseRuns: [...curr.exerciseRuns, record].slice(-MAX_EXERCISE_RECORDS),
    };
    writeLabRecords(next);
  };

  const appendWrongQuestion = (record: WrongQuestionRecord) => {
    const curr = readLabRecords();
    const deduped = curr.wrongQuestions.filter(
      (x) => !(x.courseId === record.courseId && x.questionId === record.questionId && x.selectedAnswer === record.selectedAnswer),
    );
    const next: LabRecordsState = {
      ...curr,
      wrongQuestions: [...deduped, record].slice(-MAX_WRONG_RECORDS),
    };
    writeLabRecords(next);
  };

  const appendChallengeAttempt = (record: ChallengeAttemptRecord) => {
    const curr = readLabRecords();
    const next: LabRecordsState = {
      ...curr,
      challengeAttempts: [...curr.challengeAttempts, record].slice(-MAX_CHALLENGE_RECORDS),
    };
    writeLabRecords(next);
  };

  const getQuality = (courseId: string): QualityState => quality[courseId] || defaultQuality();

  const isCourseUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    const prev = LAB_COURSES[idx - 1];
    return getQuality(prev.id).challengePassed;
  };

  const fetchHealth = async () => {
    setHealth({ loading: true, data: null });
    try {
      const res = await axios.get(`${API_BASE}/python-lab/health`);
      setHealth({ loading: false, data: res.data });
    } catch (err: any) {
      setHealth({ loading: false, data: { ok: false, message: err?.response?.data?.error || err.message } });
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/datasets`);
      setDatasets(res.data || []);
    } catch {
      setDatasets([]);
    }
  };

  const ensureDatasetForCourse = async (course: LabCourse): Promise<string> => {
    const target = course.recommendedDataset.toLowerCase();

    const pullDatasets = async () => {
      const res = await axios.get(`${API_BASE}/datasets`);
      const list = res.data || [];
      setDatasets(list);
      return list;
    };

    let list = datasets;
    let found = list.find((ds: any) => ds.name?.toLowerCase().includes(target));

    if (!found) {
      try {
        await axios.post(`${API_BASE}/datasets/import-sample/${target}`);
        list = await pullDatasets();
      } catch {
        message.warning(`Auto-import failed for sample dataset ${target}. Please import manually.`);
      }
      found = list.find((ds: any) => ds.name?.toLowerCase().includes(target));
    }

    const v = found?.versions?.[0];
    return v ? String(v.id) : '';
  };

  const loadCourse = async (course: LabCourse, mode: LabMode) => {
    setLoading(true);
    setSelectedCourse(course);
    setActiveMode(mode);
    setChallengeAnswers({});
    setChallengeSubmitted(false);

    const sourceCells = mode === 'tutorial' ? course.tutorialCells : mode === 'exercise' ? course.exerciseCells : [];
    setCells(sourceCells.map((c) => ({ ...c, content: c.starterCode || c.content, output: undefined, running: false })));

    if (mode === 'challenge') {
      setSelectedVersionId('');
      setLoading(false);
      window.scrollTo(0, 0);
      return;
    }

    const autoVersionId = await ensureDatasetForCourse(course);
    setSelectedVersionId(autoVersionId);
    if (!autoVersionId) message.warning('Dataset not auto-bound. Select/import dataset before running code.');

    setLoading(false);
    window.scrollTo(0, 0);
  };

  const updateQualityOnRun = (courseId: string, passedStep: boolean) => {
    setQuality((prev) => {
      const q = prev[courseId] || defaultQuality();
      const next = {
        ...q,
        attempts: q.attempts + 1,
        retries: q.retries + (passedStep ? 0 : 1),
        firstPass: q.attempts === 0 ? passedStep : q.firstPass,
        passedCheckpoints: q.passedCheckpoints + (passedStep ? 1 : 0),
      };
      const merged = { ...prev, [courseId]: next };
      persistProgress({ completed: Array.from(completedStages), score, badges, quality: merged });
      return merged;
    });
  };

  const normalizeAnswer = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

  const isQuizAnswerCorrect = (q: QuizQuestion, raw: string): boolean => {
    if ((q.kind || 'single') === 'fill') {
      const expected = normalizeAnswer(String(q.answerText || ''));
      return expected.length > 0 && normalizeAnswer(raw) === expected;
    }
    const picked = Number(raw);
    return Number.isFinite(picked) && picked === Number(q.correctIndex ?? -1);
  };

  const checkSingleChallengeQuestion = (q: QuizQuestion) => {
    const raw = String(challengeAnswers[q.id] || '');
    if (!raw.trim()) {
      message.warning('Please answer this question first.');
      return;
    }
    const correct = isQuizAnswerCorrect(q, raw);
    setChallengeChecks((prev) => ({ ...prev, [q.id]: { checked: true, correct } }));
    if (!correct && selectedCourse) {
      const selectedIndex = Number(raw);
      const selectedAnswer = Number.isFinite(selectedIndex)
        ? String((q.options || [])[selectedIndex] || '')
        : raw;
      const correctAnswer = (q.kind || 'single') === 'fill'
        ? String(q.answerText || '')
        : String((q.options || [])[Number(q.correctIndex ?? -1)] || '');
      appendWrongQuestion({
        id: `wq_${Date.now()}_${q.id}`,
        ts: new Date().toISOString(),
        courseId: selectedCourse.id,
        courseTitle: selectedCourse.title,
        questionId: q.id,
        question: q.question,
        selectedAnswer,
        correctAnswer,
        explanation: q.explanation,
      });
    }
  };
  const goToNextChallengeQuestion = () => {
    const q = quizQuestions[challengeStepIndex];
    if (!q) return;
    if (!challengeChecks[q.id]?.checked) {
      message.warning('Please check the current question first.');
      return;
    }
    if (challengeStepIndex < quizQuestions.length - 1) {
      setChallengeStepIndex((x) => x + 1);
    }
  };
  const submitChallengeQuiz = () => {
    if (!selectedCourse) return;
    const questions = selectedCourse.quiz || [];
    if (questions.length === 0) {
      message.error('No quiz configured for this lesson.');
      return;
    }

    const unchecked = questions.filter((q) => !challengeChecks[q.id]?.checked).length;
    if (unchecked > 0) {
      message.error(`Please click "Check Answer" for all questions first. Remaining: ${unchecked}`);
      return;
    }

    const correct = questions.filter((q) => challengeChecks[q.id]?.correct).length;
    const challengeScore = Math.round((correct / questions.length) * 100);

    setChallengeSubmitted(true);
    finalizeChallenge(selectedCourse, challengeScore);
  };

  const finalizeChallenge = (course: LabCourse, challengeScore: number) => {
    const questions = course.quiz || [];
    const correct = questions.filter((q) => challengeChecks[q.id]?.correct).length;
    appendChallengeAttempt({
      id: `ca_${Date.now()}_${course.id}`,
      ts: new Date().toISOString(),
      courseId: course.id,
      courseTitle: course.title,
      score: challengeScore,
      passed: challengeScore >= CHALLENGE_PASS_SCORE,
      correct,
      total: questions.length,
    });

    setQuality((prev) => {
      const q = prev[course.id] || defaultQuality();
      const passed = challengeScore >= CHALLENGE_PASS_SCORE;
      const nextQ: QualityState = {
        ...q,
        challengeAttempts: q.challengeAttempts + 1,
        challengeBestScore: Math.max(q.challengeBestScore, challengeScore),
        challengePassed: q.challengePassed || passed,
      };
      const merged = { ...prev, [course.id]: nextQ };

      if (passed) {
        const completed = new Set([...Array.from(completedStages), course.id]);
        const nextScore = score + course.points;
        const nextBadges = badges.includes(course.badgeId) ? badges : [...badges, course.badgeId];
        setCompletedStages(completed);
        setScore(nextScore);
        setBadges(nextBadges);
        persistProgress({ completed: Array.from(completed), score: nextScore, badges: nextBadges, quality: merged });
        setSuccessModal({ visible: true, course, challengeScore });
      } else {
        persistProgress({ completed: Array.from(completedStages), score, badges, quality: merged });
        setChallengeModal({ visible: true, score: challengeScore, required: CHALLENGE_PASS_SCORE });
      }

      return merged;
    });
  };

  const runCell = async (idx: number) => {
    const current = cells[idx];
    if (current.type !== 'code') return;

    const requireDataset = activeMode !== 'tutorial';
    if (requireDataset && !selectedVersionId) {
      message.error('This mode requires dataset binding. Please select/import a dataset first.');
      return;
    }

    const next = [...cells];
    next[idx].running = true;
    setCells(next);

    const codeToRun = [selectedCourse?.bootstrapCode || '', ...cells.slice(0, idx + 1).filter((c) => c.type === 'code').map((c) => c.content)].join('\n\n');

    const placeholderHints = findPlaceholderHints(codeToRun);
    if (current.requiresFill && placeholderHints.length > 0) {
      const after = [...cells];
      after[idx].running = false;
      after[idx].output = {
        logs: [],
        plots: [],
        tests: [],
        checkpointResults: [],
        success: false,
        error: 'Incomplete code: placeholders still present',
        placeholderStatus: { hasUnfilled: true, missingCount: placeholderHints.length },
        lineHints: placeholderHints,
        nextRecommendedAction: 'Replace ____ / TODO in this and previous cells before running checks.',
      };
      setCells(after);
      message.error('Please fill all placeholders before running this step.');
      if (selectedCourse) {
        updateQualityOnRun(selectedCourse.id, false);
        appendExerciseRecord({
          id: `er_${Date.now()}_${current.id}`,
          ts: new Date().toISOString(),
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          cellId: current.id,
          cellLabel: current.label,
          code: current.content,
          passed: false,
          isFinalStep: idx === cells.length - 1,
          error: 'Incomplete code: placeholders still present',
          checkpointResults: [],
          tests: [],
        });
      }
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/python-lab/run`, {
        code: codeToRun,
        datasetVersionId: selectedVersionId,
        tests: idx === cells.length - 1 ? selectedCourse?.practice?.tests : undefined,
        stepTests: current.checkpointTests || undefined,
        cellId: current.id,
        requireDataset,
        courseId: selectedCourse?.id,
        validatePlaceholders: Boolean(current.requiresFill),
        checkAlias: current.checkAlias,
      });

      const output: RunOutput = res.data;
      const after = [...cells];
      after[idx].output = output;
      after[idx].running = false;
      setCells(after);

      const passedStep = !(output.checkpointResults || []).some((x) => x.status === 'failed');
      if (selectedCourse) {
        updateQualityOnRun(selectedCourse.id, passedStep);
        appendExerciseRecord({
          id: `er_${Date.now()}_${current.id}`,
          ts: new Date().toISOString(),
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          cellId: current.id,
          cellLabel: current.label,
          code: current.content,
          passed: passedStep,
          isFinalStep: idx === cells.length - 1,
          error: output.error || null,
          checkpointResults: output.checkpointResults || [],
          tests: output.tests || [],
        });
      }

      const isLast = idx === cells.length - 1;
      const finalTestsPassed = (output.tests || []).length > 0 && (output.tests || []).every((t) => t.status === 'passed');

      if (selectedCourse && activeMode === 'exercise' && isLast && output.success && finalTestsPassed) {
        message.success('Exercise complete. Next step: start Challenge Quiz and score >= 80 to unlock next lesson.');
      }
    } catch (err: any) {
      const after = [...cells];
      after[idx].running = false;
      after[idx].output = {
        logs: [],
        plots: [],
        tests: [],
        checkpointResults: [],
        success: false,
        error: err.response?.data?.error || err.message,
        envStatus: err.response?.data?.envStatus,
        datasetStatus: err.response?.data?.datasetStatus,
        nextRecommendedAction: err.response?.data?.nextRecommendedAction,
        placeholderStatus: err.response?.data?.placeholderStatus,
        lineHints: err.response?.data?.lineHints,
      };
      setCells(after);
      if (selectedCourse) {
        updateQualityOnRun(selectedCourse.id, false);
        appendExerciseRecord({
          id: `er_${Date.now()}_${current.id}`,
          ts: new Date().toISOString(),
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          cellId: current.id,
          cellLabel: current.label,
          code: current.content,
          passed: false,
          isFinalStep: idx === cells.length - 1,
          error: err.response?.data?.error || err.message,
          checkpointResults: [],
          tests: [],
        });
      }
    }
  };

  if (!selectedCourse) {
    return (
      <div style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#fff', padding: '56px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: 28, padding: '14px 16px', borderRadius: 10, background: health.loading ? '#f8fafc' : health.data?.ok ? '#ecfeff' : '#fef2f2', border: `1px solid ${health.loading ? '#e2e8f0' : health.data?.ok ? '#a5f3fc' : '#fecaca'}` }}>
            {health.loading ? 'Checking PythonLab runtime...' : `Runtime status: ${health.data?.message || (health.data?.ok ? 'healthy' : 'unhealthy')}`}
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 30, margin: 0, fontWeight: 900 }}>PythonLab Learning Path</h2>
            <p style={{ color: '#64748b', marginTop: 8 }}>Challenge mode is required for progression. Score 80+ to earn badge and unlock next lesson.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LAB_COURSES.map((course, idx) => {
              const unlocked = isCourseUnlocked(idx);
              const q = getQuality(course.id);
              return (
                <div key={course.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: unlocked ? 1 : 0.55 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <b style={{ fontSize: 16 }}>{idx + 1}. {course.title}</b>
                      <Tag color={course.difficulty === 'Beginner' ? 'blue' : course.difficulty === 'Intermediate' ? 'gold' : 'purple'} style={{ margin: 0 }}>{course.difficulty}</Tag>
                      {q.challengePassed && <Tag color="success" style={{ margin: 0 }}>Unlocked next</Tag>}
                      {!unlocked && <Tag color="default" style={{ margin: 0 }}>Locked</Tag>}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>{course.objective}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Dataset: {course.recommendedDataset} · Duration: {course.duration} · Best challenge score: {q.challengeBestScore}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button disabled={!unlocked} onClick={() => loadCourse(course, 'tutorial')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'grid', placeItems: 'center', cursor: unlocked ? 'pointer' : 'not-allowed' }} title="Tutorial"><BookOpen size={18} /></button>
                    <button disabled={!unlocked} onClick={() => loadCourse(course, 'exercise')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'grid', placeItems: 'center', cursor: unlocked ? 'pointer' : 'not-allowed' }} title="Exercise"><Code2 size={18} /></button>
                    <button disabled={!unlocked} onClick={() => loadCourse(course, 'challenge')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'grid', placeItems: 'center', cursor: unlocked ? 'pointer' : 'not-allowed' }} title="Challenge"><Trophy size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const runDisabled = activeMode === 'exercise' && !selectedVersionId;
  const currentQuality = getQuality(selectedCourse.id);
  const quizQuestions = selectedCourse.quiz || [];
  const currentChallengeQuestion = quizQuestions[challengeStepIndex];
  const currentChallengeCheck = currentChallengeQuestion ? challengeChecks[currentChallengeQuestion.id] : undefined;

  return (
    <div style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#fff' }}>
      <div style={{ height: 62, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20, position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <button onClick={() => setSelectedCourse(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronLeft size={18} /><span style={{ fontWeight: 600 }}>Back</span>
        </button>
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>
          {selectedCourse.title} · {activeMode === 'tutorial' ? 'Tutorial' : activeMode === 'exercise' ? 'Exercise' : 'Challenge'}
        </span>
        <div style={{ flex: 1 }} />
        {activeMode === 'exercise' && <Tag color="processing" icon={<Zap size={12} />} style={{ borderRadius: 6, margin: 0 }}>Practice mode</Tag>}
        {activeMode === 'challenge' && <Tag color="error" icon={<Trophy size={12} />} style={{ borderRadius: 6, margin: 0 }}>Challenge mode (pass {">="} {CHALLENGE_PASS_SCORE})</Tag>}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 24px 48px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>{selectedCourse.chapter}: {selectedCourse.title}</h1>
        <p style={{ color: '#4a5568', marginBottom: 12 }}>{selectedCourse.objective}</p>
        <div style={{ marginBottom: 16, fontSize: 13, color: '#334155' }}>
          Challenge best score: <b>{currentQuality.challengeBestScore}</b> · Required: <b>{CHALLENGE_PASS_SCORE}</b>
        </div>

        {activeMode === 'tutorial' && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 8 }}>
            <button onClick={() => loadCourse(selectedCourse, 'exercise')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
              Go to Exercise
            </button>
            <button onClick={() => loadCourse(selectedCourse, 'challenge')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ef4444', background: '#fff5f5', color: '#b91c1c', cursor: 'pointer' }}>
              Start Quiz Challenge
            </button>
          </div>
        )}

        {activeMode === 'exercise' && (
          <div style={{ marginBottom: 16, padding: 14, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Dataset binding</div>
            <select value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)} style={{ minWidth: 340, height: 34, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}>
              <option value="">Select dataset version</option>
              {datasetVersionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {!selectedVersionId && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>No dataset bound. Run is disabled.</div>}
          </div>
        )}

        {activeMode === 'exercise' && (
          <div style={{ marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Checkpoint list</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {selectedCourse.exerciseCheckpoints.map((cp) => (
                <div key={cp.id} style={{ fontSize: 12, color: '#334155' }}>
                  <b>{cp.title}</b> · {cp.blocking ? 'blocking' : 'non-blocking'} · hint: {cp.hint}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>
        ) : activeMode === 'challenge' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {quizQuestions.length === 0 && (
              <div style={{ padding: 16, border: '1px solid #fde68a', borderRadius: 12, background: '#fffbeb', color: '#92400e' }}>
                No quiz configured for this lesson yet.
              </div>
            )}

            {currentChallengeQuestion && (
              <div style={{ border: '1px solid #dbeafe', borderRadius: 16, padding: 16, background: 'linear-gradient(180deg,#f8fbff 0%,#ffffff 45%)', boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Question {challengeStepIndex + 1} / {quizQuestions.length}</div>
                  <div style={{ fontSize: 12, color: '#1d4ed8' }}>Complete current question to unlock next</div>
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{currentChallengeQuestion.question}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(currentChallengeQuestion.options || []).map((opt, optIdx) => (
                    <label key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                      <input
                        type="radio"
                        name={currentChallengeQuestion.id}
                        checked={(challengeAnswers[currentChallengeQuestion.id] || '') === String(optIdx)}
                        onChange={() => {
                          setChallengeAnswers((prev) => ({ ...prev, [currentChallengeQuestion.id]: String(optIdx) }));
                          setChallengeChecks((prev) => {
                            const next = { ...prev };
                            delete next[currentChallengeQuestion.id];
                            return next;
                          });
                          setChallengeSubmitted(false);
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => checkSingleChallengeQuestion(currentChallengeQuestion)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>
                    Check Answer
                  </button>
                  {currentChallengeCheck?.checked && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: currentChallengeCheck.correct ? '#166534' : '#991b1b' }}>
                      {currentChallengeCheck.correct ? 'Checked: Correct' : 'Checked: Try again'}
                    </span>
                  )}
                </div>

                {currentChallengeCheck?.checked && (
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: currentChallengeCheck.correct ? '#f0fdf4' : '#fef2f2', color: currentChallengeCheck.correct ? '#166534' : '#991b1b' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{currentChallengeCheck.correct ? 'Correct' : 'Incorrect'}</div>
                    <div style={{ fontSize: 13 }}>Explanation: {currentChallengeQuestion.explanation}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setChallengeStepIndex((x) => Math.max(0, x - 1))}
                disabled={challengeStepIndex === 0}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: challengeStepIndex === 0 ? '#f1f5f9' : '#fff', color: '#334155', cursor: challengeStepIndex === 0 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>

              {challengeStepIndex < quizQuestions.length - 1 ? (
                <button
                  onClick={goToNextChallengeQuestion}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Next Question
                </button>
              ) : (
                <button
                  onClick={submitChallengeQuiz}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(220,38,38,0.25)' }}
                >
                  Finish Challenge
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            {cells.map((cell, idx) => (
              <NotebookCellView
                key={cell.id}
                cell={cell}
                index={idx}
                runDisabled={runDisabled}
                showPromptCard={activeMode === 'exercise' && !!cell.prompt}
                allowRunWhenLocked={activeMode === 'tutorial'}
                onRun={() => runCell(idx)}
                onUpdate={(newVal) => {
                  const next = [...cells];
                  next[idx].content = newVal;
                  setCells(next);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={successModal.visible} footer={null} closable={false} width={440} onCancel={() => setSuccessModal({ visible: false })}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 80, height: 80, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Award size={48} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>Challenge Passed</h2>
          <p style={{ color: '#64748b', marginBottom: 8 }}>
            <strong>{successModal.course?.title}</strong> challenge score: <strong>{successModal.challengeScore}</strong>
          </p>
          <p style={{ color: '#64748b', marginBottom: 22 }}>
            Badge granted and next lesson unlocked.
          </p>
          <button onClick={() => { setSuccessModal({ visible: false }); setSelectedCourse(null); }} style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Back to course list
          </button>
        </div>
      </Modal>

      <Modal open={challengeModal.visible} footer={null} onCancel={() => setChallengeModal((s) => ({ ...s, visible: false }))} width={420}>
        <div style={{ padding: '8px 0' }}>
          <h3 style={{ marginTop: 0 }}>Challenge not passed</h3>
          <p style={{ marginBottom: 6 }}>Current score: <b>{challengeModal.score}</b></p>
          <p style={{ marginBottom: 16 }}>Required score: <b>{challengeModal.required}</b></p>
          <button onClick={() => setChallengeModal((s) => ({ ...s, visible: false }))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            Continue practicing
          </button>
        </div>
      </Modal>

      <style>{`
        .markdown-body pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 14px 0; }
        .markdown-body code { background: #f1f5f9; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.9em; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { border: none; margin-top: 1.4em; margin-bottom: 0.8em; font-weight: 800; }
        :root { --font-mono: "JetBrains Mono", "Fira Code", monospace; }
      `}</style>
    </div>
  );
};

export default PythonLab;



























