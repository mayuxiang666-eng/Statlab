import React, { useState } from 'react';
import { Modal, message } from 'antd';
import {
  BookOpen, CheckCircle, AlertTriangle, BarChart2, Award,
  Star, Play, ChevronRight, Lock, FileText, Upload,
  TrendingUp, Zap, RefreshCcw, Download, ArrowRight
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notebook {
  id: string;
  courseId: string;   // maps to LabCourse.id in CourseData
  title: string;
  stage: number;
  completedAt?: string;
  skills: string[];
  accuracy?: number;
  status: 'completed' | 'in-progress' | 'locked';
}

interface Assignment {
  id: string;
  courseId: string;
  title: string;
  stage: number;
  description: string;
  tests: string[];
  hints: string[];
  dueLabel: string;
  status: 'pending' | 'passed' | 'partial' | 'failed';
  feedback?: { type: 'pass' | 'partial' | 'fail'; message: string; hint?: string; code?: string };
  code: string;
}

interface Achievement {
  id: string;
  title: string;
  stage: number;
  description: string;
  skills: string[];
  projectName: string;
  projectAccuracy?: string;
  projectEfficiency?: string;
  completedAt: string;
  nextCourseId?: string;
}

// ─── Mock Data (courseId maps to LAB_COURSES ids) ────────────────────────────
const MOCK_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb1', courseId: 'lesson_1', title: '模型是如何工作的？', stage: 1,
    skills: ['决策树概念', '模型训练思想', '预测原理'],
    completedAt: '2026-03-10', accuracy: 100, status: 'completed'
  },
  {
    id: 'nb2', courseId: 'lesson_2', title: '基础数据探索', stage: 2,
    skills: ['Pandas', '统计摘要', '数据预览'],
    completedAt: '2026-03-14', accuracy: 92, status: 'completed'
  },
  {
    id: 'nb3', courseId: 'lesson_3', title: '你的第一个机器学习模型', stage: 3,
    skills: ['特征选择', '模型训练', '拟合'],
    status: 'in-progress'
  },
  {
    id: 'nb4', courseId: 'lesson_4', title: '模型验证', stage: 4,
    skills: ['MAE', '数据切分', '评估'], status: 'locked'
  },
];

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a1', courseId: 'lesson_2', title: '数据探索练习：价格摘要', stage: 2,
    description: '使用 describe() 函数。',
    tests: ['assert "average_price" in locals()'],
    hints: ['使用 df["Price"].mean()'],
    dueLabel: '已完成', status: 'passed',
    code: 'average_price = df["Price"].mean()',
    feedback: { type: 'pass', message: '完美！你已掌握基础统计。' }
  },
];

const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach1', title: '入门掌握者', stage: 1,
    description: '你已经理解了机器学习模型的工作原理。',
    skills: ['预测思维', '决策树概念'],
    projectName: '模型原理理解', projectAccuracy: '100%', projectEfficiency: 'A+',
    completedAt: '2026-03-10', nextCourseId: 'lesson_2'
  },
];

// ─── Tab type ─────────────────────────────────────────────────────────────────
type LabTab = 'notebooks' | 'assignments' | 'achievements';

// ─── LabPortal Props ──────────────────────────────────────────────────────────
interface LabPortalProps {
  initialTab?: LabTab;
  onGoToCourse: (courseId: string) => void;  // navigate to PythonLab with a specific course
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
const FeedbackModal: React.FC<{
  assignment: Assignment | null;
  onClose: () => void;
  onRetry: (courseId: string) => void;
}> = ({ assignment, onClose, onRetry }) => {
  if (!assignment) return null;
  const fb = assignment.feedback;
  const color = fb?.type === 'pass' ? '#22c55e' : fb?.type === 'partial' ? '#f59e0b' : '#ef4444';
  const bgColor = fb?.type === 'pass' ? 'rgba(34,197,94,0.06)' : fb?.type === 'partial' ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)';
  const label = fb?.type === 'pass' ? '✅ 全部通过' : fb?.type === 'partial' ? '⚠️ 部分通过' : '❌ 需要修改';

  return (
    <Modal
      open={!!assignment}
      footer={null}
      onCancel={onClose}
      centered
      width={560}
      styles={{
        content: { background: '#fff', borderRadius: 16, padding: 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
        mask: { backdropFilter: 'blur(4px)' }
      }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>SUBMISSION RESULT</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{assignment.title}</div>
        </div>
        <div style={{ background: bgColor, border: `1px solid ${color}`, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, color }}>{label}</div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Feedback message */}
        <div style={{ background: bgColor, border: `1px solid ${color}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.7 }}>{fb?.message || '暂无评估结果'}</p>
        </div>

        {/* Actionable Hint */}
        {fb?.hint && (
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Zap size={14} color="#3b82f6" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Actionable Hint</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#475569' }}>{fb.hint}</p>
            {fb.code && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', fontFamily: '"Fira Code", monospace', fontSize: 12, color: '#86efac', position: 'relative' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{fb.code}</pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(fb.code || ''); message.success('代码已复制！'); }}
                  style={{ display: 'block', marginTop: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Copy snippet
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tests checklist */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>测试结果</div>
          {assignment.tests.map((test, i) => {
            const passed = assignment.status === 'passed' || (assignment.status === 'partial' && i === 0);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: passed ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
                {passed ? <CheckCircle size={14} color="#22c55e" /> : <AlertTriangle size={14} color="#f87171" />}
                <code style={{ fontSize: 12, color: passed ? '#166534' : '#991b1b', fontFamily: '"Fira Code", monospace', flex: 1 }}>{test}</code>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {assignment.status !== 'passed' && (
            <button
              onClick={() => { onClose(); onRetry(assignment.courseId); }}
              style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <RefreshCcw size={15} /> 去修改代码
            </button>
          )}
          <button
            onClick={onClose}
            style={{ flex: assignment.status === 'passed' ? 1 : 0, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {assignment.status === 'passed' ? '继续学习 →' : '关闭'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Achievement Detail Full-page ─────────────────────────────────────────────
const AchievementDetail: React.FC<{
  ach: Achievement;
  onBack: () => void;
  onGoToCourse: (courseId: string) => void;
}> = ({ ach, onBack, onGoToCourse }) => (
  <div style={{ height: 'calc(100vh - 64px)', background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
    {/* Top nav */}
    <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: '6px 8px', borderRadius: 6, transition: 'all 0.15s' }}>
        ← 返回成果列表
      </button>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>Achievement Report · Stage {ach.stage}</div>
    </div>

    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
      <div style={{ width: '100%', maxWidth: 700, background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', padding: '48px 40px', textAlign: 'center' }}>
        {/* Trophy icon with ripple */}
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 24px' }}>
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'rgba(37,99,235,0.04)', animation: 'pulse 2s infinite' }} />
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(37,99,235,0.4)' }}>
              <Award size={36} color="#fff" />
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{ach.title}</h1>
        <p style={{ fontSize: 15, color: '#64748b', marginBottom: 36, lineHeight: 1.7 }}>{ach.description}</p>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, textAlign: 'left', marginBottom: 28 }}>
          {/* Skills */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Star size={16} color="#2563eb" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>New Skills Unlocked</span>
            </div>
            {ach.skills.map((skill, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#334155' }}>{skill}</span>
              </div>
            ))}
          </div>

          {/* Project summary */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project Summary</span>
              <BarChart2 size={16} color="#2563eb" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 16 }}>{ach.projectName}</div>
            {ach.projectAccuracy && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{ach.projectAccuracy}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Accuracy</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{ach.projectEfficiency}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Efficiency</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {ach.nextCourseId && (
            <button
              onClick={() => onGoToCourse(ach.nextCourseId!)}
              style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(37,99,235,0.3)', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}
            >
              Start Next Stage <ArrowRight size={16} />
            </button>
          )}
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px' }}
          >
            <Download size={13} /> Save Notebook to Profile
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main LabPortal ───────────────────────────────────────────────────────────
const LabPortal: React.FC<LabPortalProps> = ({ initialTab = 'notebooks', onGoToCourse }) => {
  const [activeTab, setActiveTab] = useState<LabTab>(initialTab);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Load real progress
  const [realProgress, setRealProgress] = useState<{ completed: string[], score: number, badges: string[] }>({
    completed: [], score: 0, badges: []
  });

  React.useEffect(() => {
    const saved = localStorage.getItem('python_lab_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRealProgress({
          completed: parsed.completed || [],
          score: parsed.score || 0,
          badges: parsed.badges || []
        });
      } catch (e) {}
    }
  }, []);

  if (selectedAchievement) {
    return (
      <AchievementDetail
        ach={selectedAchievement}
        onBack={() => setSelectedAchievement(null)}
        onGoToCourse={onGoToCourse}
      />
    );
  }

  const tabs: { key: LabTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'notebooks', label: '我的实验室', icon: <BookOpen size={15} />, count: MOCK_NOTEBOOKS.filter(n => n.status !== 'locked').length },
    { key: 'assignments', label: '作业 & 反馈', icon: <FileText size={15} />, count: MOCK_ASSIGNMENTS.filter(a => a.status === 'pending').length },
    { key: 'achievements', label: '我的成果', icon: <Award size={15} />, count: MOCK_ACHIEVEMENTS.length },
  ];

  const notebookStatusInfo = (status: Notebook['status']) => {
    if (status === 'completed') return { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', label: '已完成' };
    if (status === 'in-progress') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '进行中' };
    return { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: '未解锁' };
  };

  const assignmentStatusInfo = (status: Assignment['status']) => {
    if (status === 'passed') return { color: '#22c55e', label: '已通过', bg: 'rgba(34,197,94,0.08)' };
    if (status === 'partial') return { color: '#f59e0b', label: '部分通过', bg: 'rgba(245,158,11,0.08)' };
    if (status === 'failed') return { color: '#ef4444', label: '未通过', bg: 'rgba(239,68,68,0.08)' };
    return { color: '#94a3b8', label: '待完成', bg: 'rgba(148,163,184,0.08)' };
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px',
                background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.key ? '#2563eb' : '#64748b',
                fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer',
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {tab.icon} {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{ background: activeTab === tab.key ? '#2563eb' : '#e2e8f0', color: activeTab === tab.key ? '#fff' : '#64748b', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 7px', lineHeight: '16px' }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* ── 我的实验室 ── */}
          {activeTab === 'notebooks' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>我的实验室</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>所有已保存的课程 Notebook</p>
                </div>
              </div>

              {/* Overall Progress Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: 18, padding: '24px', marginBottom: 28, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Learning Progress</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{Math.round((realProgress.completed.length / MOCK_NOTEBOOKS.length) * 100)}%</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${(realProgress.completed.length / MOCK_NOTEBOOKS.length) * 100}%`, background: 'linear-gradient(90deg, #2563eb, #60a5fa)', borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{realProgress.completed.length}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>COMPLETED</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{MOCK_NOTEBOOKS.length - realProgress.completed.length}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>REMAINING</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, borderLeft: '1px solid #f1f5f9', paddingLeft: 24 }}>
                  <div style={{ flex: 1, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
                    <Star size={20} color="#fbbf24" fill="#fbbf24" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{realProgress.score}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>TOTAL POINTS</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
                    <Award size={20} color="#2563eb" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{realProgress.badges.length}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>MEDALS</div>
                  </div>
                </div>
              </div>

              {/* Notebook Cards */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Learning Path</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MOCK_NOTEBOOKS.map((nb, idx) => {
                  const done = realProgress.completed.includes(nb.courseId);
                  const isCurrent = !done && (idx === 0 || realProgress.completed.includes(MOCK_NOTEBOOKS[idx-1].courseId));
                  const locked = !done && !isCurrent;
                  
                  const statusLabel = done ? '已完成' : isCurrent ? '进行中' : '未解锁';
                  const si = {
                    color: done ? '#22c55e' : isCurrent ? '#2563eb' : '#94a3b8',
                    bg: done ? '#f0fdf4' : isCurrent ? '#f0f7ff' : '#f8fafc',
                    label: statusLabel
                  };

                  return (
                    <div
                      key={nb.id}
                      style={{ background: '#fff', border: `1px solid ${isCurrent ? '#2563eb' : '#e2e8f0'}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 16, opacity: locked ? 0.6 : 1, transition: 'all 0.15s', cursor: !locked ? 'pointer' : 'default' }}
                      onClick={() => !locked && onGoToCourse(nb.courseId)}
                      onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.1)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
                    >
                      {/* Status icon */}
                      <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? '#22c55e' : isCurrent ? '#2563eb' : '#e2e8f0', boxShadow: isCurrent ? '0 0 12px rgba(37,99,235,0.4)' : 'none' }}>
                        {done ? <CheckCircle size={18} color="#fff" /> : isCurrent ? <Play size={16} color="#fff" style={{ marginLeft: 2 }} /> : <Lock size={14} color="#94a3b8" />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{nb.title}</span>
                          <span style={{ fontSize: 11, background: si.bg, color: si.color, borderRadius: 99, padding: '2px 8px', border: `1px solid ${si.color}33`, fontWeight: 700 }}>{si.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {nb.skills.map((s, si2) => <span key={si2} style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '1px 6px' }}>{s}</span>)}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!locked && (
                          <button
                            onClick={e => { e.stopPropagation(); onGoToCourse(nb.courseId); }}
                            style={{
                              background: isCurrent ? '#2563eb' : '#f1f5f9',
                              color: isCurrent ? '#fff' : '#475569',
                              border: isCurrent ? 'none' : '1px solid #e2e8f0',
                              borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                              boxShadow: isCurrent ? '0 4px 12px rgba(37,99,235,0.2)' : 'none',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isCurrent ? <><Play size={12} /> Continue Lesson</> : <>Review</>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ marginTop: 32, textAlign: 'center', padding: '16px 0' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Need help or feeling stuck? </span>
                {['Documentation', 'Community Forum', 'Live Support'].map((link, i) => (
                  <React.Fragment key={link}>
                    <span style={{ fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>{link}</span>
                    {i < 2 && <span style={{ color: '#94a3b8', margin: '0 8px' }}>·</span>}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          {/* ── 作业 & 反馈 ── */}
          {activeTab === 'assignments' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>作业 & 反馈</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>点击课程卡片开始练习，或查看分层反馈</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {MOCK_ASSIGNMENTS.map((a) => {
                  const asi = assignmentStatusInfo(a.status);
                  return (
                    <div key={a.id} style={{ background: '#fff', border: `1px solid ${a.status === 'partial' ? '#f59e0b33' : '#e2e8f0'}`, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{a.title}</span>
                            <span style={{ fontSize: 11, background: asi.bg, color: asi.color, borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>{asi.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#64748b' }}>{a.description}</div>
                        </div>
                        <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0, marginLeft: 16 }}>{a.dueLabel}</span>
                      </div>

                      {/* Code preview */}
                      {a.code && (
                        <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', fontFamily: '"Fira Code", monospace', fontSize: 12, color: '#86efac', marginBottom: 12 }}>
                          <pre style={{ margin: 0 }}>{a.code}</pre>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* View feedback */}
                        {a.feedback && (
                          <button
                            onClick={() => setSelectedAssignment(a)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            <FileText size={13} /> 查看反馈
                          </button>
                        )}
                        {/* Start / Retry in PythonLab */}
                        <button
                          onClick={() => onGoToCourse(a.courseId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: a.status === 'pending' ? '#2563eb' : '#f1f5f9', color: a.status === 'pending' ? '#fff' : '#475569', border: a.status === 'pending' ? 'none' : '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {a.status === 'pending' ? <><Play size={13} /> 开始练习</> : a.status === 'passed' ? <>Review 课程</> : <><RefreshCcw size={13} /> 重新练习</>}
                        </button>
                        {/* Hint toggle */}
                        {a.status !== 'passed' && (
                          <button
                            onClick={() => { message.info(a.hints.join(' → '), 5); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
                          >
                            <Zap size={13} /> 查看提示
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── 我的成果 ── */}
          {activeTab === 'achievements' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>我的成果</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>每个完成的 Stage 都会生成一份成就报告</p>
              </div>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                  { icon: <Award size={20} color="#2563eb" />, value: MOCK_ACHIEVEMENTS.length, label: '已完成 Stage', color: 'rgba(37,99,235,0.08)' },
                  { icon: <Star size={20} color="#f59e0b" />, value: MOCK_ACHIEVEMENTS.reduce((acc, a) => acc + a.skills.length, 0), label: '已获技能', color: 'rgba(245,158,11,0.08)' },
                  { icon: <TrendingUp size={20} color="#22c55e" />, value: '94%', label: '平均准确率', color: 'rgba(34,197,94,0.08)' },
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{stat.icon}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Achievement cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {MOCK_ACHIEVEMENTS.map(ach => (
                  <div
                    key={ach.id}
                    onClick={() => setSelectedAchievement(ach)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 20 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid #2563eb33'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(37,99,235,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid #e2e8f0'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Award size={24} color="#2563eb" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{ach.title}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{ach.description}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ach.skills.map((s, i) => (
                          <span key={i} style={{ fontSize: 11, background: 'rgba(37,99,235,0.07)', color: '#2563eb', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {ach.projectAccuracy && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{ach.projectAccuracy}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>准确率</span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{ach.completedAt}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: 12, justifyContent: 'flex-end', fontWeight: 600 }}>
                        查看详情 <ChevronRight size={13} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {MOCK_ACHIEVEMENTS.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 32px', color: '#94a3b8' }}>
                  <Award size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>暂无成就</div>
                  <div style={{ fontSize: 13 }}>完成 Stage 1 后，你的第一个成就将在这里显示！</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        assignment={selectedAssignment}
        onClose={() => setSelectedAssignment(null)}
        onRetry={onGoToCourse}
      />
    </div>
  );
};

export default LabPortal;
