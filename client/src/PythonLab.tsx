import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message, Spin, Select, Modal, Radio, Space, Tag, Breadcrumb } from 'antd';
import {
  Play, CheckCircle, AlertTriangle, BookOpen, ChevronLeft,
  Database, Lightbulb, Lock, Target, Terminal,
  Image as ImageIcon, Award, GraduationCap, Star, Code2, Zap,
  ExternalLink, ArrowRight, RefreshCw, FileText, ChevronRight
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

type LabMode = 'tutorial' | 'exercise';

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

// ─── Output Area ─────────────────────────────────────────────────────────────
const OutputArea: React.FC<{ output: CellWithState['output']; running: boolean }> = ({ output, running }) => {
  if (running) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', color: '#64748b', fontSize: 13, background: '#f8fafc' }}>
        <Spin size="small" />
        <span style={{ fontFamily: 'var(--font-mono)' }}>Kernel Executing...</span>
      </div>
    );
  }
  if (!output) return null;
  
  if (output.error) {
    const { title, cause, fix } = translateError(output.error);
    return (
      <div style={{ padding: '12px 24px', background: '#fff' }}>
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '0 8px 8px 0', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={15} color="#ef4444" />
            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{title}</span>
          </div>
          {cause && <p style={{ fontSize: 13, color: '#991b1b', margin: '4px 0' }}>{cause}</p>}
          {fix && <p style={{ fontSize: 13, color: '#2563eb', margin: '4px 0', fontWeight: 600 }}>Tip: {fix}</p>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>Original Traceback</summary>
            <pre style={{ marginTop: 6, padding: 10, background: '#1e1e1e', borderRadius: 6, color: '#fca5a5', fontSize: 11, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{output.error}</pre>
          </details>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ background: '#fff' }}>
      {output.logs?.length > 0 && (
        <div style={{ padding: '12px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#1e293b', background: '#f8fafc', borderTop: '1px solid #edf2f7', lineHeight: 1.6 }}>
          {output.logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {output.plots?.length > 0 && (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', borderTop: '1px solid #edf2f7' }}>
          {output.plots.map((p, i) => (
            <img key={i} src={`data:image/png;base64,${p}`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} alt={`Plot ${i + 1}`} />
          ))}
        </div>
      )}
      {output.tests?.length > 0 && (
        <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
          {output.tests.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {t.status === 'passed' ? <CheckCircle size={14} color="#16a34a" /> : <AlertTriangle size={14} color="#dc2626" />}
              <span style={{ fontSize: 13, color: t.status === 'passed' ? '#166534' : '#991b1b', fontWeight: 600 }}>{t.status === 'passed' ? '✓ Passed' : `✗ ${t.message}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Notebook Cell Renderer ──────────────────────────────────────────────────
const NotebookCellView: React.FC<{
  cell: CellWithState;
  index: number;
  onRun?: () => void;
  onUpdate?: (content: string) => void;
}> = ({ cell, index, onRun, onUpdate }) => {
  const isCode = cell.type === 'code';
  const isLocked = cell.isLocked;

  // Simple Highlighter
  const highlight = (code: string) => {
    return code
      .replace(/(#.*)/g, '<span style="color: #6a9955;">$1</span>')
      .replace(/\b(def|class|if|else|elif|for|while|import|from|as|return|in|is|and|or|not|with|try|except|finally|pass|yield|raise|break|continue)\b/g, '<span style="color: #c586c0;">$1</span>')
      .replace(/\b(True|False|None)\b/g, '<span style="color: #569cd6;">$1</span>')
      .replace(/(['"])(?:(?!\1|\\).|\\.)*\1/g, '<span style="color: #ce9178;">$1$2$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color: #b5cea8;">$1</span>')
      .replace(/\b(print|len|range|enumerate|zip|map|filter|list|dict|set|tuple|int|float|str|bool|sum|min|max|abs|type|pd|np|plt|sklearn)\b/g, '<span style="color: #4ec9b0;">$1</span>');
  };

  if (!isCode) {
    return (
      <div style={{ padding: '24px 0', maxWidth: 900, margin: '0 auto' }}>
        <div className="markdown-body" style={{ fontSize: 16, lineHeight: 1.8, color: '#2d3748' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '32px 0', maxWidth: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {/* Cell Header */}
      <div style={{ height: 48, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #edf2f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>In [{index + 1}]</div>
          {cell.label && <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cell.label}</span>}
          {isLocked && <Tag color="default" style={{ border: 'none', borderRadius: 4, height: 20, fontSize: 10 }}>READ-ONLY</Tag>}
        </div>
        {!isLocked && (
          <button 
            onClick={onRun}
            disabled={cell.running}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, 
              fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' 
            }}
          >
           {cell.running ? <Spin size="small" /> : <Play size={12} fill="currentColor" />}
           Run
          </button>
        )}
      </div>

      {/* Code Area */}
      <div style={{ display: 'flex', position: 'relative' }}>
        {/* Line Numbers */}
        <div style={{ width: 56, background: '#f1f5f9', borderRight: '1px solid #edf2f7', padding: '24px 0', textAlign: 'right', userSelect: 'none' }}>
          {cell.content.split('\n').map((_, i) => (
            <div key={i} style={{ paddingRight: 16, fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>{i + 1}</div>
          ))}
        </div>
        
        {/* Editor vs Highlighted Block */}
        {isLocked ? (
          <pre style={{ 
            flex: 1, margin: 0, padding: '24px 32px', background: '#fff', 
            fontFamily: 'var(--font-mono)', fontSize: 16, lineHeight: 1.8, color: '#1e293b', overflowX: 'auto' 
          }} dangerouslySetInnerHTML={{ __html: highlight(cell.content) }} />
        ) : (
          <textarea
            value={cell.content}
            onChange={(e) => onUpdate?.(e.target.value)}
            spellCheck={false}
            style={{ 
              flex: 1, border: 'none', outline: 'none', padding: '24px 32px', background: '#fff', 
              fontFamily: 'var(--font-mono)', fontSize: 16, lineHeight: 1.8, color: '#1e293b', 
              minHeight: 160, resize: 'vertical'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun?.(); }
            }}
          />
        )}
      </div>

      {/* Output Area */}
      {(cell.output || cell.running) && <OutputArea output={cell.output} running={!!cell.running} />}
    </div>
  );
};

// ─── Main Application ──────────────────────────────────────────────────────────
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
  const [successModal, setSuccessModal] = useState<{ visible: boolean; course?: LabCourse }>({ visible: false });

  // Load progress
  useEffect(() => {
    const saved = localStorage.getItem('python_lab_v2_progress');
    if (saved) {
      try {
        const { completed, score: s, badges: b } = JSON.parse(saved);
        setCompletedStages(new Set(completed));
        setScore(s || 0);
        setBadges(b || []);
      } catch (e) {}
    }
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/datasets`);
      setDatasets(res.data);
    } catch {}
  };

  const loadCourse = async (course: LabCourse, mode: LabMode) => {
    setLoading(true);
    setSelectedCourse(course);
    setActiveMode(mode);
    
    // Select cells based on mode
    const sourceCells = mode === 'tutorial' ? course.tutorialCells : course.exerciseCells;
    setCells(sourceCells.map(c => ({ ...c, output: undefined, running: false })));

    // Auto-match dataset
    const target = course.recommendedDataset.toLowerCase();
    let found = datasets.find((ds: any) => ds.name?.toLowerCase().includes(target));
    if (found?.versions?.length > 0) {
      setSelectedVersionId(String(found.versions[0].id));
    }
    
    setLoading(false);
    window.scrollTo(0, 0);
  };

  const runCell = async (idx: number) => {
    const next = [...cells];
    next[idx].running = true;
    setCells(next);

    const codeToRun = cells.slice(0, idx + 1).filter(c => c.type === 'code').map(c => c.content).join('\n\n');

    try {
      const res = await axios.post(`${API_BASE}/python-lab/run`, {
        code: codeToRun,
        datasetVersionId: selectedVersionId,
        tests: idx === cells.length - 1 ? selectedCourse?.practice?.tests : undefined
      });
      const after = [...cells];
      after[idx].output = res.data;
      after[idx].running = false;
      setCells(after);

      // check success for exercise
      if (activeMode === 'exercise' && idx === cells.length - 1 && res.data.success) {
        if (res.data.tests?.every((t: any) => t.status === 'passed')) {
          completeCourse(selectedCourse!);
        }
      }
    } catch (err: any) {
      const after = [...cells];
      after[idx].running = false;
      after[idx].output = { logs: [], plots: [], tests: [], success: false, error: err.response?.data?.error || err.message };
      setCells(after);
    }
  };

  const completeCourse = (course: LabCourse) => {
    setCompletedStages(prev => new Set([...Array.from(prev), course.id]));
    setScore(s => s + course.points);
    if (!badges.includes(course.badgeId)) setBadges(b => [...b, course.badgeId]);
    localStorage.setItem('python_lab_v2_progress', JSON.stringify({ 
      completed: Array.from(completedStages).concat(course.id), 
      score: score + course.points, 
      badges: badges.concat(course.badgeId) 
    }));
    setSuccessModal({ visible: true, course });
  };

  // ─── Views ───────────────────────────────────────────────────────────────────

  // 1. DASHBOARD VIEW (Image 1 style)
  if (!selectedCourse) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', padding: '64px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 48, borderBottom: '1px solid #eef2f6', paddingBottom: 32 }}>
            <h4 style={{ color: '#64748b', fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>LEARN THE CORE IDEAS...</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <button 
                style={{ background: '#1e1e1e', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
              >
                Begin Course
              </button>
              <div style={{ flex: 1, background: '#f1f5f9', height: 8, borderRadius: 4, position: 'relative' }}>
                <div style={{ width: `${(completedStages.size / LAB_COURSES.length) * 100}%`, height: '100%', background: '#e2e8f0', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{LAB_COURSES.length - completedStages.size} hours to go</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32, borderBottom: '2px solid #f1f5f9', marginBottom: 40 }}>
             <button style={{ paddingBottom: 12, borderBottom: '2px solid #1e1e1e', fontSize: 16, fontWeight: 700, background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}>Courses</button>
             <button style={{ paddingBottom: 12, fontSize: 16, fontWeight: 500, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Discussions</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>Lessons</h2>
            <div style={{ display: 'flex', gap: 40 }}>
                <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>Tutorial</span>
                <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>Exercise</span>
            </div>
          </div>

          {/* Lessons List */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {LAB_COURSES.map((course, idx) => {
              const done = completedStages.has(course.id);
              return (
                <div 
                  key={course.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0', borderTop: '1px solid #f1f5f9' }}
                >
                  <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#1e1e1e', width: 24 }}>{idx + 1}</span>
                    <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#1a202c' }}>{course.title}</h3>
                        <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>{course.objective}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 48, paddingRight: 8 }}>
                    {/* Tutorial Link */}
                    <button 
                      onClick={() => loadCourse(course, 'tutorial')}
                      style={{ 
                        width: 44, height: 44, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4a5568' 
                      }}
                      title="Tutorial"
                    >
                      <BookOpen size={20} />
                    </button>

                    {/* Exercise Link */}
                    {course.exerciseCells.length > 0 ? (
                      <button 
                        onClick={() => loadCourse(course, 'exercise')}
                        style={{ 
                          width: 44, height: 44, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4a5568' 
                        }}
                        title="Exercise"
                      >
                        <Code2 size={20} />
                      </button>
                    ) : (
                      <div style={{ width: 44 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. NOTEBOOK VIEW (Image 2 style)
  return (
    <div style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#fff' }}>
      {/* Top Header */}
      <div style={{ height: 60, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 40px', gap: 24, position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <button onClick={() => setSelectedCourse(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronLeft size={20} />
          <span style={{ fontWeight: 600 }}>Back to Lessons</span>
        </button>
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{selectedCourse.title} - {activeMode === 'tutorial' ? 'Tutorial' : 'Practice Exercise'}</span>
        
        <div style={{ flex: 1 }} />
        
        {activeMode === 'exercise' && (
           <Tag color="processing" icon={<Zap size={12} />} style={{ borderRadius: 6, fontWeight: 700 }}>Interactive Environment</Tag>
        )}
      </div>

      <div style={{ maxWidth: '100%', margin: '0 auto', padding: '48px 40px' }}>
        {/* Course Intro */}
        <div style={{ marginBottom: 40 }}>
           <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 16 }}>{selectedCourse.chapter}: {selectedCourse.title}</h1>
           <p style={{ fontSize: 16, color: '#4a5568', maxWidth: 800, lineHeight: 1.6 }}>{selectedCourse.objective}</p>
        </div>

        {/* Notebook Main Stream */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" tip="Initializing Lab Environment..." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cells.map((cell, idx) => (
              <NotebookCellView 
                key={cell.id} 
                cell={cell} 
                index={idx} 
                onRun={() => runCell(idx)}
                onUpdate={(newVal) => {
                  const n = [...cells];
                  n[idx].content = newVal;
                  setCells(n);
                }}
              />
            ))}
          </div>
        )}

        {/* Final Exercise Submit (Only if not tutorial) */}
        {activeMode === 'exercise' && (
           <div style={{ marginTop: 40, borderTop: '2px solid #f1f5f9', paddingTop: 40, textAlign: 'center' }}>
              <button 
                onClick={() => message.success('All steps completed! Stage verified.')}
                style={{ background: '#1e1e1e', color: '#fff', padding: '16px 48px', borderRadius: 12, fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer' }}
              >
                Complete & Continue
              </button>
           </div>
        )}
      </div>

      <Modal
        visible={successModal.visible}
        footer={null}
        closable={false}
        width={400}
        onCancel={() => setSuccessModal({ visible: false })}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ width: 80, height: 80, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Award size={48} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>CONGRATULATIONS!</h2>
          <p style={{ color: '#64748b', marginBottom: 32 }}>
            You've completed <strong>{successModal.course?.title}</strong> and earned <strong>+{successModal.course?.points} points</strong>.
          </p>
          <button 
            onClick={() => { setSuccessModal({ visible: false }); setSelectedCourse(null); }}
            style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
          >
            Claim Badge
          </button>
        </div>
      </Modal>

      <style>{`
        .markdown-body pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .markdown-body code { background: #f1f5f9; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.9em; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { border: none; margin-top: 2em; margin-bottom: 1em; font-weight: 800; }
        .markdown-body ul { padding-left: 20px; }
        .markdown-body li { margin-bottom: 8px; }
        :root { --font-mono: "JetBrains Mono", "Fira Code", monospace; }
      `}</style>
    </div>
  );
};

export default PythonLab;
