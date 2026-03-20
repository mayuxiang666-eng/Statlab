import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message, Spin, Select, Modal, Radio, Space, Tag } from 'antd';
import {
  Play, CheckCircle, AlertTriangle, BookOpen, ChevronLeft,
  Database, Lightbulb, Lock, Target, Terminal,
  Image as ImageIcon, Award, GraduationCap, Star, Code2, Zap
} from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LAB_COURSES, LabCourse, NotebookCell } from './CourseData';

const API_BASE = '/api';

// ─── Types ───────────────────────────────────────────────────────────────────
type CellWithState = NotebookCell & {
  running?: boolean;
  output?: {
    logs: string[];
    plots: string[];
    tests: any[];
    success: boolean;
    error?: string | null;
  };
};

// ─── Error Translation ───────────────────────────────────────────────────────
function translateError(errText: string): { title: string; cause: string; fix: string } {
  if (!errText) return { title: '未知错误', cause: '', fix: '' };
  if (errText.includes('KeyError')) {
    const match = errText.match(/KeyError: ['"']?([^'"\n]+)/);
    const col = match?.[1] || '某列';
    return {
      title: `找不到列名 "${col}"`,
      cause: `数据集中不存在名为 "${col}" 的列（Python 列名区分大小写）`,
      fix: `检查拼写，或在第一个单元格运行 print(df.columns) 查看真实列名`,
    };
  }
  if (errText.includes('NameError')) {
    const match = errText.match(/NameError: name '([^']+)'/);
    const name = match?.[1] || '某变量';
    return {
      title: `变量 "${name}" 尚未定义`,
      cause: `你使用了 "${name}"，但此变量还没有被创建或赋值`,
      fix: `确保先运行了创建 "${name}" 的那个单元格`,
    };
  }
  if (errText.includes('IndentationError')) {
    return {
      title: '缩进错误',
      cause: 'Python 对每行开头的空格非常敏感，代码块内部必须统一缩进 4 个空格',
      fix: '检查报错行前面的空格数量是否统一',
    };
  }
  if (errText.includes('ValueError')) {
    return {
      title: '数值错误',
      cause: '传入函数的数据格式或数值不符合预期',
      fix: '检查目标列是否为纯数字格式，尝试先运行 df.dtypes 查看各列类型',
    };
  }
  if (errText.includes('TypeError')) {
    return {
      title: '类型错误',
      cause: '对错误类型的对象进行了操作',
      fix: '确认变量不为 None，检查前面的单元格是否都运行成功',
    };
  }
  return { title: '代码执行出错', cause: '请查看下方详细错误信息', fix: '对照错误信息检查相应的代码行' };
}

// ─── Output Panel (right pane) ───────────────────────────────────────────────
const OutputArea: React.FC<{ output: CellWithState['output']; running: boolean }> = ({ output, running }) => {
  if (running) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px', color: '#64748b', fontSize: 13 }}>
        <Spin size="small" />
        <span>Python 内核执行中...</span>
      </div>
    );
  }
  if (!output) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 24px', color: '#94a3b8', fontSize: 13 }}>
        <Terminal size={15} />
        <span>Output will appear here after running...</span>
      </div>
    );
  }
  if (output.error) {
    const { title, cause, fix } = translateError(output.error);
    return (
      <div style={{ padding: '16px 20px' }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={15} color="#ef4444" />
            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{title}</span>
          </div>
          {cause && <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}><strong>原因：</strong>{cause}</p>}
          {fix && <p style={{ fontSize: 13, color: '#2563eb', margin: '4px 0' }}><strong>建议：</strong>{fix}</p>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>查看原始报错</summary>
            <pre style={{ marginTop: 6, padding: 10, background: '#fef2f2', borderRadius: 6, color: '#991b1b', fontSize: 11, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{output.error}</pre>
          </details>
        </div>
      </div>
    );
  }
  return (
    <div>
      {output.logs?.length > 0 && (
        <div style={{ padding: '12px 20px', fontFamily: '"Fira Code", monospace', fontSize: 12, color: '#166534', background: '#f0fdf4', borderTop: '1px solid #bbf7d0', borderRadius: '0 0 12px 12px', maxHeight: 220, overflowY: 'auto', lineHeight: 1.8 }}>
          {output.logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {output.plots?.length > 0 && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fff' }}>
          {output.plots.map((p, i) => (
            <img key={i} src={`data:image/png;base64,${p}`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} alt={`图表 ${i + 1}`} />
          ))}
        </div>
      )}
      {output.tests?.length > 0 && (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {output.tests.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: t.status === 'passed' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${t.status === 'passed' ? '#bbf7d0' : '#fecaca'}` }}>
              {t.status === 'passed' ? <CheckCircle size={14} color="#16a34a" /> : <AlertTriangle size={14} color="#dc2626" />}
              <span style={{ fontSize: 13, color: t.status === 'passed' ? '#166534' : '#991b1b', fontWeight: 600 }}>{t.status === 'passed' ? '✓ 通过' : `✗ ${t.message || '未通过'}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Left Panel: Theory Cell Renderer ────────────────────────────────────────
const TheoryCell: React.FC<{ cell: NotebookCell; sectionLabel?: string }> = ({ cell, sectionLabel }) => {
  const baseText = { fontSize: 14, color: '#475569', lineHeight: 1.8 };

  if (cell.type === 'objective') {
    return (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target size={18} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Objectives</h3>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ background: 'rgba(37,99,235,0.08)', padding: 10, borderRadius: 12, flexShrink: 0 }}>
            <CheckCircle size={20} color="#2563eb" />
          </div>
          <div style={baseText} className="theory-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.content}</ReactMarkdown>
          </div>
        </div>
      </section>
    );
  }

  if (cell.type === 'summary') {
    return (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Award size={18} color="#16a34a" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Summary</h3>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 24 }}>
          <div style={{ ...baseText, color: '#166534' }} className="theory-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.content}</ReactMarkdown>
          </div>
        </div>
      </section>
    );
  }

  if (cell.type === 'markdown') {
    const isExample = cell.content.includes('```') || cell.content.startsWith('### 📖') || cell.content.startsWith('### Step');
    const label = sectionLabel || (isExample ? 'Concept' : 'Theory');
    const Icon = isExample ? Lightbulb : BookOpen;
    return (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Icon size={18} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{label}</h3>
        </div>
        <div style={{ background: 'rgba(37,99,235,0.03)', border: '1px solid rgba(37,99,235,0.1)', borderRadius: 16, padding: 24 }}>
          <div style={baseText} className="theory-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.content}</ReactMarkdown>
          </div>
        </div>
      </section>
    );
  }

  // Locked code cell → show as Example
  if (cell.type === 'code' && cell.isLocked) {
    return (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Code2 size={18} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Example</h3>
        </div>
        <div style={{ background: '#0f172a', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', gap: 6, padding: '12px 16px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <pre style={{ margin: 0, padding: '0 24px 24px', fontFamily: '"Fira Code", monospace', fontSize: 13, color: '#94a3b8', lineHeight: 1.8, overflow: 'auto' }}>
            <code>{cell.content}</code>
          </pre>
        </div>
      </section>
    );
  }

  return null;
};

// ─── Right Panel: Kaggle-style Code Cell (Example + Exercise with own ▶ Run button) ──
const CodeCell: React.FC<{
  cell: CellWithState;
  displayIndex: number;
  totalCells: number;
  onRun: () => void;
  onUpdate: (content: string) => void;
}> = ({ cell, displayIndex, totalCells, onRun, onUpdate }) => {
  const isExample = !!cell.isLocked;
  const hasError  = !!cell.output?.error;
  const isSuccess = !!cell.output && !hasError && !cell.running;
  const borderColor = hasError ? '#fecaca' : isSuccess ? '#bbf7d0' : isExample ? '#e2e8f0' : 'rgba(37,99,235,0.25)';

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Label + per-cell ▶ Run button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {isExample ? (
              <>
                <Code2 size={12} color="#64748b" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Example</span>
              </>
            ) : (
              <>
                <Zap size={12} color="#2563eb" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Turn</span>
              </>
            )}
            <span style={{ fontSize: 11, color: '#cbd5e1', fontFamily: '"Fira Code", monospace', marginLeft: 4 }}>In [{displayIndex}]:</span>
          </div>
          {isExample && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
              先读注释和变量名，再运行观察输出。
            </div>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={!!cell.running}
          title="Run cell (Ctrl+Enter)"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px',
            background: cell.running ? '#f1f5f9' : isExample ? '#f8fafc' : '#2563eb',
            border: `1px solid ${cell.running ? '#e2e8f0' : isExample ? '#d1d5db' : '#2563eb'}`,
            borderRadius: 6, color: cell.running ? '#94a3b8' : isExample ? '#374151' : '#fff',
            fontSize: 12, fontWeight: 600, cursor: cell.running ? 'wait' : 'pointer', transition: 'all 0.15s',
          }}
        >
          {cell.running ? <Spin size="small" /> : <Play size={12} />}
          {cell.running ? '运行中' : '▶ Run'}
        </button>
      </div>

      {/* Cell body */}
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: isExample ? 'none' : '0 2px 8px rgba(37,99,235,0.06)' }}>
        <textarea
          value={cell.content}
          onChange={e => !isExample && onUpdate(e.target.value)}
          readOnly={isExample}
          spellCheck={false}
          placeholder={isExample ? '' : '# 在此写下你的代码...'}
          style={{
            width: '100%', display: 'block',
            background: isExample ? '#fafafa' : '#fff',
            color: isExample ? '#374151' : '#1e293b',
            fontFamily: '"Fira Code", monospace', fontSize: 13,
            padding: '14px 18px', border: 'none', outline: 'none',
            resize: 'vertical', minHeight: isExample ? 75 : 120,
            lineHeight: 1.75, tabSize: 4, boxSizing: 'border-box',
            cursor: isExample ? 'default' : 'text',
          }}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
          }}
        />
        {(cell.output || cell.running) && (
          <div style={{ borderTop: `1px solid ${borderColor}`, background: '#fafafa' }}>
            <OutputArea output={cell.output} running={!!cell.running} />
          </div>
        )}
      </div>

      {/* "↓ Now you try it" divider shown after last locked example */}
      {isExample && displayIndex < totalCells && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>↓ 现在试试看</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PythonLab: React.FC<{ initialCourseId?: string }> = ({ initialCourseId }) => {
  const [selectedCourse, setSelectedCourse] = useState<LabCourse | null>(null);
  const [cells, setCells] = useState<CellWithState[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [practiceRunning, setPracticeRunning] = useState(false);
  const [practiceResult, setPracticeResult] = useState<any>(null);
  const [showHints, setShowHints] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [successModal, setSuccessModal] = useState<{ visible: boolean; course?: LabCourse }>({ visible: false });
  const [quizState, setQuizState] = useState<{
    visible: boolean;
    course?: LabCourse;
    questionIdx: number;
    selected: number | null;
    feedback: string | null;
    correctCount: number;
  }>({ visible: false, questionIdx: 0, selected: null, feedback: null, correctCount: 0 });

  const pendingCourseRef = useRef<string | undefined>(initialCourseId);

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('python_lab_progress');
    if (saved) {
      try {
        const { completed, score: s, badges: b } = JSON.parse(saved);
        setCompletedStages(new Set(completed));
        setScore(s || 0);
        setBadges(b || []);
      } catch (e) {
        console.error('Failed to load progress', e);
      }
    }
  }, []);

  // Save progress
  useEffect(() => {
    localStorage.setItem('python_lab_progress', JSON.stringify({
      completed: Array.from(completedStages),
      score,
      badges
    }));
  }, [completedStages, score, badges]);

  // When initialCourseId changes: if datasets already loaded, load immediately;
  // otherwise record for fetchDatasets to pick up after it finishes.
  useEffect(() => {
    if (!initialCourseId) return;
    pendingCourseRef.current = initialCourseId;
    // Use functional form to read current datasets without stale closure
    setDatasets(current => {
      if (current.length > 0) {
        const course = LAB_COURSES.find(c => c.id === initialCourseId);
        if (course) {
          pendingCourseRef.current = undefined;
          // Schedule outside render
          setTimeout(() => loadCourseWithDatasets(course, current), 0);
        }
      }
      return current; // no change to datasets state
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCourseId]);

  // Fetch datasets on mount
  useEffect(() => { fetchDatasets(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/datasets`);
      const data = res.data;
      setDatasets(data);
      if (data.length > 0 && data[0].versions?.length > 0) {
        setSelectedVersionId(String(data[0].versions[0].id));
      }
      // Auto-load pending course now that datasets are available
      if (pendingCourseRef.current) {
        const course = LAB_COURSES.find(c => c.id === pendingCourseRef.current);
        if (course) {
          pendingCourseRef.current = undefined;
          await loadCourseWithDatasets(course, data);
        }
      }
    } catch {
      message.error('无法加载数据集列表');
    } finally {
      setLoading(false);
    }
  };

  // loadCourseWithDatasets: accepts datasets explicitly so it doesn't depend on stale state
  const loadCourseWithDatasets = async (course: LabCourse, availableDatasets: any[]) => {
    setSelectedCourse(course);
    setCells(course.cells.map(c => ({ ...c, output: undefined, running: false })));
    setPracticeResult(null);
    setShowHints(false);

    const target = course.recommendedDataset.toLowerCase();
    let found = availableDatasets.find((ds: any) =>
      ds.name?.toLowerCase().includes(target) ||
      ds.originalFilename?.toLowerCase().includes(target)
    );

    if (!found) {
      try {
        const importRes = await axios.post(`${API_BASE}/datasets/import-sample/${target}`);
        const refreshRes = await axios.get(`${API_BASE}/datasets`);
        setDatasets(refreshRes.data);
        found = refreshRes.data.find((ds: any) => String(ds.id) === String(importRes.data?.id));
        availableDatasets = refreshRes.data;
      } catch { /* silent */ }
    }

    if (found?.versions?.length > 0) {
      setSelectedVersionId(String(found.versions[0].id));
      message.success(`已匹配数据集：${found.name}`);
    } else {
      message.warning(`请选择 "${course.recommendedDataset}" 对应数据集`);
    }
  };

  const loadCourse = (course: LabCourse) => loadCourseWithDatasets(course, datasets);

  const runCell = async (idx: number) => {
    const next = [...cells];
    next[idx].running = true;
    setCells(next);

    const codeToRun = cells
      .slice(0, idx + 1)
      .filter(c => c.type === 'code')
      .map(c => c.content)
      .join('\n\n');

    try {
      const res = await axios.post(`${API_BASE}/python-lab/run`, {
        code: codeToRun,
        datasetVersionId: selectedVersionId,
      });
      const after = [...cells];
      after[idx].output = res.data;
      after[idx].running = false;
      setCells(after);
    } catch (err: any) {
      const after = [...cells];
      after[idx].running = false;
      after[idx].output = {
        logs: [], plots: [], tests: [], success: false,
        error: err.response?.data?.error || err.message
      };
      setCells(after);
    }
  };

  const updateCell = useCallback((idx: number, content: string) => {
    setCells(prev => { const n = [...prev]; n[idx] = { ...n[idx], content }; return n; });
  }, []);

  const runPractice = async () => {
    if (!selectedCourse?.practice) return;
    setPracticeRunning(true);
    const code = cells.filter(c => c.type === 'code').map(c => c.content).join('\n\n');
    try {
      const res = await axios.post(`${API_BASE}/python-lab/run`, {
        code,
        datasetVersionId: selectedVersionId,
        tests: selectedCourse.practice.tests,
      });
      setPracticeResult(res.data);
      const allPass = res.data?.tests?.every((t: any) => t.status === 'passed');
      if (allPass) {
        if (selectedCourse.quiz && selectedCourse.quiz.length > 0) {
          message.success('代码校验通过！现在请完成结课小测验');
          setQuizState({
            visible: true,
            course: selectedCourse,
            questionIdx: 0,
            selected: null,
            feedback: null,
            correctCount: 0
          });
        } else {
          completeCourse(selectedCourse);
        }
      } else {
        message.warning('部分测试未通过，请检查代码后重试');
      }
    } catch (err: any) {
      message.error('校验失败: ' + (err.response?.data?.error || err.message));
    } finally {
      setPracticeRunning(false);
    }
  };

  const completeCourse = (course: LabCourse) => {
    setCompletedStages(prev => new Set([...Array.from(prev), course.id]));
    setScore(s => s + course.points);
    if (!badges.includes(course.badgeId)) {
      setBadges(b => [...b, course.badgeId]);
    }
    setSuccessModal({ visible: true, course });
  };

  const handleQuizAnswer = () => {
    if (!quizState.course || quizState.selected === null) return;
    const q = quizState.course.quiz![quizState.questionIdx];
    const isCorrect = quizState.selected === q.correctIndex;

    setQuizState(prev => ({
      ...prev,
      feedback: isCorrect ? '✅ 答对了！' : `❌ 答错了。${q.explanation}`,
      correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount
    }));
  };

  const nextQuizStep = () => {
    if (!quizState.course) return;
    const isLast = quizState.questionIdx === quizState.course.quiz!.length - 1;
    if (isLast) {
      if (quizState.correctCount >= quizState.course.quiz!.length) {
        // Passed all
        setQuizState(prev => ({ ...prev, visible: false }));
        completeCourse(quizState.course);
      } else {
        message.error('测验未完全通过，请重新开始测验');
        setQuizState(prev => ({ ...prev, questionIdx: 0, selected: null, feedback: null, correctCount: 0 }));
      }
    } else {
      setQuizState(prev => ({
        ...prev,
        questionIdx: prev.questionIdx + 1,
        selected: null,
        feedback: null
      }));
    }
  };

  // Partition cells:
  // LEFT panel  = objective + markdown + summary (text/theory only)
  // RIGHT panel = ALL code cells (locked examples + editable exercises)
  const theoryCells = cells.filter(c => c.type === 'objective' || c.type === 'summary' || c.type === 'markdown');
  const allCodeCells = cells
    .map((c, i) => ({ cell: c, originalIndex: i }))
    .filter(({ cell }) => cell.type === 'code');

  const totalCourses = LAB_COURSES.length;
  const progressPct = Math.round((completedStages.size / totalCourses) * 100);

  // ── Course Selector ────────────────────────────────────────────────────────
  if (!selectedCourse) {
    return (
      <div style={{ height: 'calc(100vh - 64px)', background: '#f8fafc', overflowY: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 32px' }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={24} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Python Learning Lab</div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>学习路径</h1>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ background: '#fff', padding: '6px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Star size={16} color="#fbbf24" fill="#fbbf24" />
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{score}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Points</span>
                </div>
                <div style={{ background: '#fff', padding: '6px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Award size={16} color="#2563eb" />
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{badges.length}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Badges</span>
                </div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: 14, margin: '12px 0 24px', lineHeight: 1.7 }}>
              从零开始，系统掌握 Python 数据分析与机器学习。完成 4 个学习阶段，构建你的第一个 ML 项目。
            </p>

            {/* Progress bar */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>总体进度</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{progressPct}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: '#2563eb', borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{completedStages.size} / {totalCourses} 课程已完成</div>
            </div>
          </div>

          {/* Courses grouped by stage */}
          {([1, 2, 3, 4] as const).map(stage => {
            const stageCourses = LAB_COURSES.filter(c => c.stage === stage);
            const stageLabels: Record<number, string> = {
              1: 'Python 与数据基础', 2: '机器学习入门', 3: '特征工程', 4: '综合迷你项目',
            };
            return (
              <div key={stage} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {stage}
                  </div>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Stage {stage}</span>
                    <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>·  {stageLabels[stage]}</span>
                  </div>
                </div>

                {stageCourses.map(course => {
                  const done = completedStages.has(course.id);
                  const prevStageCourses = LAB_COURSES.filter(c => c.stage === stage - 1);
                  const prevUnlocked = stage === 1 || prevStageCourses.every(c => completedStages.has(c.id));
                  
                  return (
                    <div
                      key={course.id}
                      onClick={() => prevUnlocked ? loadCourse(course) : message.error('请先完成之前的 Stage')}
                      role="button"
                      tabIndex={0}
                      style={{
                        background: '#fff', border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`,
                        borderRadius: 14, padding: '18px 22px', marginBottom: 10,
                        cursor: prevUnlocked ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                        opacity: prevUnlocked ? 1 : 0.6,
                        filter: prevUnlocked ? 'none' : 'grayscale(0.5)'
                      }}
                      onMouseEnter={e => { if(prevUnlocked) { (e.currentTarget as HTMLDivElement).style.border = '1px solid #2563eb'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.1)'; } }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {done ? <CheckCircle size={15} color="#16a34a" /> : !prevUnlocked ? <Lock size={15} color="#94a3b8" /> : null}
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{course.title}</span>
                          <span style={{ fontSize: 11, background: 'rgba(37,99,235,0.08)', color: '#2563eb', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{course.difficulty}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{course.objective}</p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#fbbf24', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>+{course.points} pts</span>
                          {course.tags.map(t => (
                            <span key={t} style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1px 7px' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>⏱ {course.duration}</span>
                        {prevUnlocked ? <Play size={16} color="#2563eb" /> : <Lock size={16} color="#cbd5e1" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <style>{`
          .theory-md p { margin-bottom: 10px; }
          .theory-md code { background: rgba(37,99,235,0.08); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-family: "Fira Code", monospace; font-size: 0.9em; }
          .theory-md pre { background: #0f172a; color: #94a3b8; border-radius: 10px; padding: 16px; overflow: auto; }
          .theory-md strong { color: #0f172a; font-weight: 700; }
          .theory-md ul, .theory-md ol { padding-left: 20px; margin-bottom: 10px; }
          .theory-md li { margin-bottom: 6px; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        `}</style>
      </div>
    );
  }

  // ── Notebook Editor ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f8fafc', overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <header style={{
        height: 64, background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        boxShadow: '0 1px 0 #e2e8f0',
      }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedCourse(null)}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#475569', transition: 'all 0.15s', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Course title */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Stage {selectedCourse.stage} · {selectedCourse.chapter}
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{selectedCourse.title}</h2>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, maxWidth: 360, padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Course Progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#2563eb', borderRadius: 99 }} />
          </div>
        </div>

        {/* Dataset selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Database size={14} color="#94a3b8" />
          <Select
            size="small"
            style={{ width: 160, fontSize: 12 }}
            loading={loading}
            value={selectedVersionId || undefined}
            onChange={setSelectedVersionId}
            placeholder="选择数据集..."
          >
            {datasets.map((ds: any) =>
              ds.versions?.map((v: any) => (
                <Select.Option key={v.id} value={String(v.id)}>{ds.name} (v{v.version})</Select.Option>
              ))
            )}
          </Select>
        </div>

        {/* Hints button */}
        {selectedCourse.practice && (
          <button
            onClick={() => setShowHints(h => !h)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: showHints ? '#fffbeb' : '#fff',
              border: `1px solid ${showHints ? '#fbbf24' : '#e2e8f0'}`,
              borderRadius: 8, color: showHints ? '#d97706' : '#64748b',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0
            }}
          >
            <Lightbulb size={15} /> Hints
          </button>
        )}

        {/* Completed badge */}
        {completedStages.has(selectedCourse.id) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            <CheckCircle size={13} /> 已完成
          </span>
        )}
      </header>

      {/* ── Hints Banner ── */}
      {showHints && selectedCourse.practice?.hints && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '12px 32px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Lightbulb size={16} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>练习提示</div>
            {selectedCourse.practice.hints.map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: '#92400e' }}>→ {h}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── Practice Result Banner ── */}
      {practiceResult && (
        <div style={{
          background: practiceResult.tests?.every((t: any) => t.status === 'passed') ? '#f0fdf4' : '#fef2f2',
          borderBottom: `1px solid ${practiceResult.tests?.every((t: any) => t.status === 'passed') ? '#bbf7d0' : '#fecaca'}`,
          padding: '10px 32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {practiceResult.tests?.map((t: any, i: number) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 600,
                background: t.status === 'passed' ? '#dcfce7' : '#fee2e2',
                color: t.status === 'passed' ? '#16a34a' : '#dc2626'
              }}>
                {t.status === 'passed' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                {t.status === 'passed' ? '通过' : `未通过: ${t.message || ''}`}
              </span>
            ))}
          </div>
          <button onClick={() => setPracticeResult(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>关闭</button>
        </div>
      )}

      {/* ── Main: Split Pane ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Theory Panel */}
        <aside style={{
          width: '48%', overflowY: 'auto', borderRight: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '36px 36px 48px' }}>
            {theoryCells.map((cell, i) => (
              <TheoryCell key={cell.id || i} cell={cell} />
            ))}
            {theoryCells.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <BookOpen size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                <span>本课程为纯实践模式</span>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT: Interactive Editor */}
        <section style={{ width: '52%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          {/* Editor header */}
          <div style={{ height: 44, borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Code2 size={13} color="#94a3b8" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>exercise.py</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {allCodeCells.map(({ cell }, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: cell.output ? (cell.output.error ? '#ef4444' : '#22c55e') : '#e2e8f0', transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>

          {selectedCourse.practice && (
            <div style={{ margin: '20px 24px 0', border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={15} color="#2563eb" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Practice Goal</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                {selectedCourse.practice.title}
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: selectedCourse.practice.targetMetrics ? 10 : 0 }}>
                {selectedCourse.practice.description}
              </div>
              {selectedCourse.practice.targetMetrics && (
                <div style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 10px' }}>
                  验收标准：{selectedCourse.practice.targetMetrics}
                </div>
              )}
            </div>
          )}

          {/* Scrollable cells (Kaggle notebook style: examples + exercises interleaved) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 80px' }}>
            {allCodeCells.length > 0 ? (
              allCodeCells.map(({ cell, originalIndex }, displayIdx) => (
                <CodeCell
                  key={cell.id || originalIndex}
                  cell={cell}
                  displayIndex={displayIdx + 1}
                  totalCells={allCodeCells.length}
                  onRun={() => runCell(originalIndex)}
                  onUpdate={content => updateCell(originalIndex, content)}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <Code2 size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                <span>本节无互动练习</span>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Terminal size={13} /> Press Ctrl + Enter to run
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Run All button */}
              <button
                onClick={() => {
                  // Run all cells sequentially
                  allCodeCells.reduce((promise, { originalIndex }) =>
                    promise.then(() => runCell(originalIndex)),
                    Promise.resolve()
                  );
                }}
                disabled={allCodeCells.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10,
                  color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Play size={14} /> Run All
              </button>

              {/* Check my code */}
              {selectedCourse.practice && (
                <button
                  onClick={runPractice}
                  disabled={practiceRunning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                    background: '#2563eb', border: 'none', borderRadius: 10,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: practiceRunning ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
                    opacity: practiceRunning ? 0.8 : 1, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!practiceRunning) e.currentTarget.style.background = '#1d4ed8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
                >
                  {practiceRunning ? <Spin size="small" /> : <CheckCircle size={15} />}
                  {practiceRunning ? '检验中...' : 'Check My Code'}
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Success Modal ── */}
      <Modal
        open={successModal.visible}
        footer={null}
        onCancel={() => setSuccessModal({ visible: false })}
        centered
        width={480}
        styles={{
          mask: { backdropFilter: 'blur(4px)' },
          content: { background: '#fff', borderRadius: 24, border: 'none', padding: 0, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }
        }}
      >
        <div style={{ padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', position: 'relative' }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}>
              <Award size={32} color="#fff" />
            </div>
            <div style={{ position: 'absolute', top: -5, right: -5, background: '#fbbf24', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff' }}>
              <Star size={14} color="#fff" fill="#fff" />
            </div>
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>课程圆满完成！🎉</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>+{successModal.course?.points}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Points</div>
            </div>
            <div style={{ width: 1, height: 40, background: '#e2e8f0' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: 15 }}>New Badge Unlocked</div>
            </div>
          </div>
          
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>你解锁了 <strong>{successModal.course?.badgeId}</strong> 勋章并掌握了：</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            {successModal.course?.skills.map((s, i) => (
              <span key={i} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 600 }}>
                {s}
              </span>
            ))}
          </div>
          <button
            onClick={() => { setSuccessModal({ visible: false }); setSelectedCourse(null); }}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 25px rgba(37,99,235,0.3)', width: '100%', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            领取奖励并返回学习路径 →
          </button>
        </div>
      </Modal>

      {/* ── Quiz Modal ── */}
      <Modal
        open={quizState.visible}
        footer={null}
        closable={false}
        centered
        width={540}
        styles={{
          mask: { backdropFilter: 'blur(8px)' },
          content: { background: '#fff', borderRadius: 24, border: 'none', padding: 0, overflow: 'hidden' }
        }}
      >
        <div style={{ background: '#0f172a', padding: '24px 32px', color: '#fff', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Knowledge Check</span>
            <Tag color="#38bdf8" style={{ margin: 0, fontWeight: 700 }}>Question {quizState.questionIdx + 1} of {quizState.course?.quiz?.length}</Tag>
          </div>
          
          {/* Progress Bar in header */}
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 16 }}>
            <div style={{ 
              height: '100%', 
              width: `${((quizState.questionIdx) / (quizState.course?.quiz?.length || 1)) * 100}%`, 
              background: '#38bdf8', 
              borderRadius: 2, 
              transition: 'width 0.3s ease' 
            }} />
          </div>

          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
            {quizState.course?.quiz?.[quizState.questionIdx].question}
          </h3>
        </div>
        
        <div style={{ padding: '32px' }}>
          <Radio.Group 
            onChange={e => setQuizState(prev => ({ ...prev, selected: e.target.value }))} 
            value={quizState.selected}
            disabled={quizState.feedback !== null}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {quizState.course?.quiz?.[quizState.questionIdx].options.map((opt, i) => (
                <Radio.Button 
                  key={i} 
                  value={i}
                  style={{ 
                    width: '100%', height: 'auto', padding: '14px 20px', borderRadius: 12, border: quizState.selected === i ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: quizState.selected === i ? '#f0f7ff' : '#fff', color: '#1e293b', fontSize: 14, fontWeight: 500, lineHeight: 1.5,
                    display: 'block'
                  }}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </Radio.Button>
              ))}
            </Space>
          </Radio.Group>

          {quizState.feedback && (
            <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 12, background: quizState.feedback.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${quizState.feedback.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, color: quizState.feedback.startsWith('✅') ? '#166534' : '#991b1b', fontSize: 14, lineHeight: 1.6 }}>
              {quizState.feedback}
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            {!quizState.feedback ? (
              <button
                onClick={handleQuizAnswer}
                disabled={quizState.selected === null}
                style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: quizState.selected === null ? 'not-allowed' : 'pointer', opacity: quizState.selected === null ? 0.6 : 1 }}
              >
                提交答案
              </button>
            ) : (
              <button
                onClick={nextQuizStep}
                style={{ width: '100%', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {quizState.questionIdx === (quizState.course?.quiz?.length || 0) - 1 ? '完成测试' : '下一题'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <style>{`
        .theory-md p { margin-bottom: 10px; }
        .theory-md code { background: rgba(37,99,235,0.08); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-family: "Fira Code", monospace; font-size: 0.9em; }
        .theory-md pre { background: #0f172a; color: #94a3b8; border-radius: 10px; padding: 16px; margin: 12px 0; overflow: auto; }
        .theory-md strong { color: #0f172a; font-weight: 700; }
        .theory-md ul, .theory-md ol { padding-left: 20px; margin-bottom: 10px; }
        .theory-md li { margin-bottom: 6px; }
        .theory-md h2, .theory-md h3 { color: #0f172a; margin: 16px 0 8px; font-weight: 700; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default PythonLab;
