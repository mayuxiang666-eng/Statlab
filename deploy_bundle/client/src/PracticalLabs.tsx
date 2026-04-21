import React, { useState, useEffect, useCallback } from 'react';
import {
  Beaker, Play, CheckCircle, Clock, Lock, Star, Zap,
  Target, Brain, Award, TrendingUp, Cpu, Database
} from 'lucide-react';
import CertificateModal from './components/CertificateModal';
import SkillMissionModal, { MissionScenario } from './components/SkillMissionModal';
import XpToast from './components/XpToast';
import { useAuth } from './context/AuthContext';

/* ─── XP / Tier thresholds ─────────────────────────────────────────── */
const TIER_THRESHOLDS = [
  { tier: 1, label: '工业数据入门', min: 0 },
  { tier: 2, label: '中级工业分析师', min: 300 },
  { tier: 3, label: '工业AI专家', min: 700 },
];

function getTier(xp: number) {
  return [...TIER_THRESHOLDS].reverse().find(t => xp >= t.min) || TIER_THRESHOLDS[0];
}

/* ─── Scenario data ─────────────────────────────────────────────────── */
type NodeStatus = 'completed' | 'ready' | 'locked';

interface ScenarioBase {
  id: string;
  x: number; y: number;
  title: string;
  icon: string;
  difficulty: string;
  duration: string;
  branch: 'ml' | 'stats' | 'dl';
  requires: string;
  mission: string;
  desc: string;
  skills: string[];
  xpReward: number;
  tier: 1 | 2 | 3;
  next?: string[];
  defaultStatus: NodeStatus;
}

const SCENARIOS: ScenarioBase[] = [
  {
    id: 'data_basics', x: 200, y: 70, tier: 1,
    title: '产线数据清洗基础',
    icon: 'Database', difficulty: 'Beginner', duration: '20 min',
    branch: 'stats', requires: '系统入门', xpReward: 100,
    mission: '任务：3号车间传感器数据含大量缺失值，请完成数据清洗与统计汇总。',
    desc: '读取 CSV → 缺失值填充 → 异常值剔除 → 基础统计描述。',
    skills: ['pandas read_csv', '缺失值处理', 'describe()'],
    defaultStatus: 'ready', next: ['motor_vibration', 'yield_opt']
  },
  {
    id: 'motor_vibration', x: 600, y: 70, tier: 1,
    title: '电机振动异常预警',
    icon: 'Zap', difficulty: 'Intermediate', duration: '30 min',
    branch: 'ml', requires: '数据清洗基础', xpReward: 150,
    mission: '任务：3号生产线电机运行不稳，利用时序信号构建预测性维护模型。',
    desc: '处理时序振动信号，提取频域特征，训练 Isolation Forest 异常检测模型。',
    skills: ['FFT 变换', 'Isolation Forest', '时序滑动窗口'],
    defaultStatus: 'locked', next: ['yield_opt', 'deep_fault']
  },
  {
    id: 'yield_opt', x: 200, y: 270, tier: 2,
    title: 'A-Line 涂装良率根因',
    icon: 'Target', difficulty: 'Advanced', duration: '45 min',
    branch: 'stats', requires: '线性回归基础', xpReward: 160,
    mission: '急诊：涂装车间良率环比下降 5%，找出影响薄膜均匀度的关键变量。',
    desc: '多元逐步回归分析温度、湿度对良率的影响，找出最优工艺区间。',
    skills: ['多元逐步回归', '中继效应分析', '工艺参数优化'],
    defaultStatus: 'locked', next: ['stock_demand']
  },
  {
    id: 'energy_pred', x: 600, y: 270, tier: 2,
    title: '建筑能耗预测模型',
    icon: 'TrendingUp', difficulty: 'Advanced', duration: '40 min',
    branch: 'ml', requires: '机器学习基础', xpReward: 160,
    mission: '任务：构建厂区能耗预测模型，指导错峰用电调度策略。',
    desc: '特征工程 + XGBoost 回归，MAE 达标后导出到部署实训。',
    skills: ['XGBoost', '特征工程', 'MAE 评估'],
    defaultStatus: 'locked', next: ['stock_demand', 'deep_fault']
  },
  {
    id: 'deep_fault', x: 1000, y: 270, tier: 2,
    title: '基于 CNN 的轴承损伤分类',
    icon: 'Brain', difficulty: 'Advanced', duration: '50 min',
    branch: 'dl', requires: '神经网络基础', xpReward: 200,
    mission: '挑战：利用声音信号识别轴承微小裂纹造成的声学指纹差异。',
    desc: '将逆振动信号转化为格拉姆角场图像，CNN 高精度损伤等级分类。',
    skills: ['信号图像化', 'CNN 架构', '模型轻量化'],
    defaultStatus: 'locked', next: ['sensor_fusion']
  },
  {
    id: 'stock_demand', x: 200, y: 470, tier: 3,
    title: '物流库存需求预测',
    icon: 'Star', difficulty: 'Expert', duration: '60 min',
    branch: 'stats', requires: '时间序列基础', xpReward: 200,
    mission: '优化：半导体备件库存积压，建立精准月度需求预测模型。',
    desc: '结合历史发货量与生产计划，构建多步时间序列预测模型。',
    skills: ['Auto-ARIMA', 'XGBoost', '库存补货算法'],
    defaultStatus: 'locked', next: ['full_pipeline']
  },
  {
    id: 'sensor_fusion', x: 700, y: 470, tier: 3,
    title: '工业传感器数据融合',
    icon: 'Cpu', difficulty: 'Expert', duration: '55 min',
    branch: 'ml', requires: 'CNN 基础', xpReward: 200,
    mission: '进阶：融合温度、振动、电流多模态传感器数据，提升故障检测精度。',
    desc: '多传感器融合 + Stacking 集成，建立高鲁棒性的联合诊断模型。',
    skills: ['多模态融合', 'Stacking 集成', '注意力机制'],
    defaultStatus: 'locked', next: ['full_pipeline']
  },
  {
    id: 'full_pipeline', x: 450, y: 670, tier: 3,
    title: '全流程综合实战',
    icon: 'Award', difficulty: 'Master', duration: '90 min',
    branch: 'dl', requires: '全部 Tier 2 通关', xpReward: 300,
    mission: '终极挑战：从原始传感器数据到模型部署推理，完整重现工业 AI 落地全流程。',
    desc: '数据清洗 → 特征工程 → 模型训练 → 模型评估 → 轻量化部署 → API 封装。',
    skills: ['端到端流水线', 'ONNX 导出', 'FastAPI 封装'],
    defaultStatus: 'locked'
  },
];

/* ─── Mission content (full data for 2 unlocked nodes) ─────────────── */
const MISSION_DATA: Record<string, Omit<MissionScenario, 'id' | 'title' | 'branch' | 'difficulty' | 'xpReward' | 'mission' | 'desc'>> = {
  data_basics: {
    briefing: {
      context: '3号车间的 PLC 每秒采集温度、振动、电流三路信号。由于网络抖动，过去30天数据中有约8%行存在缺失(NaN)值，另有约2%的温度值超出设备量程（>150℃）。本任务要求你：1) 读取数据；2) 用均值填充温度缺失值；3) 将异常温度行剔除；4) 输出统计摘要。',
      tableHeaders: ['timestamp', 'temperature', 'vibration', 'current'],
      tableRows: [
        ['2024-01-01 08:00', '72.3', '0.12', '4.8'],
        ['2024-01-01 08:01', 'NaN', '0.14', '4.9'],
        ['2024-01-01 08:02', '71.8', 'NaN', '4.7'],
        ['2024-01-01 08:03', '168.5', '0.11', '4.8'],
        ['2024-01-01 08:04', '73.1', '0.13', '5.0'],
      ]
    },
    coding: {
      referenceCode: `import pandas as pd

# 示例：读取并清洗数据
df = pd.read_csv('sensor_data.csv')

# 填充缺失值
df['temperature'].fillna(
    df['temperature'].mean(), inplace=True)

# 剔除异常值
df = df[df['temperature'] <= 150]

print(df.describe())`,
      templateCode: `import pandas as pd

# TODO: 读取 sensor_data.csv
df = pd.read_csv('___')

# TODO: 用均值填充 temperature 列的缺失值
df['temperature'].fillna(
    df['temperature'].___(), inplace=True)

# TODO: 剔除 temperature > 150 的行
df = df[df['temperature'] ___ 150]

# 输出统计摘要
print(df.describe())`,
      solutionKeywords: ['read_csv', 'fillna', 'mean'],
      hint: '关键方法：pd.read_csv() 读取文件；Series.fillna(Series.mean()) 均值填充；布尔索引 df[condition] 过滤行。'
    },
    quiz: [
      { question: '处理缺失值时，均值填充适合哪类分布的数据？', options: ['正态分布或对称分布', '严重右偏分布', '二值分类变量', '任何分布均适合'], correctIndex: 0 },
      { question: 'pandas 中剔除异常值最常用的方法是？', options: ['df.drop()', '布尔索引过滤', 'df.replace()', 'df.reset_index()'], correctIndex: 1 },
      { question: 'describe() 输出中 "50%" 代表什么统计量？', options: ['平均值', '众数', '中位数', '方差'], correctIndex: 2 },
    ]
  },
  yield_opt: {
    briefing: {
      context: '涂装车间A-Line使用机器人喷涂系统。传感器记录了30天的 喷涂温度(temp)、车间湿度(humidity)、喷嘴气压(pressure) 以及当日良率(yield_rate)。统计部门发现良率从96%降至91%，需要你用多元回归找出关键影响因子并确定最优工艺参数区间。',
      tableHeaders: ['date', 'temp(℃)', 'humidity(%)', 'pressure(bar)', 'yield(%)'],
      tableRows: [
        ['2024-01-01', '23.5', '55', '2.8', '96.2'],
        ['2024-01-02', '24.1', '62', '2.7', '94.8'],
        ['2024-01-05', '25.3', '71', '2.6', '92.1'],
        ['2024-01-08', '23.8', '68', '2.9', '93.5'],
        ['2024-01-10', '22.9', '58', '3.0', '95.7'],
      ]
    },
    coding: {
      referenceCode: `import statsmodels.api as sm
import pandas as pd

df = pd.read_csv('coating_data.csv')
y = df['yield_rate']
X = df[['temp', 'humidity', 'pressure']]
X = sm.add_constant(X)

model = sm.OLS(y, X).fit()
print(model.summary())
# 查看 p值 < 0.05 的显著变量`,
      templateCode: `import statsmodels.api as sm
import pandas as pd

df = pd.read_csv('coating_data.csv')
y = df['yield_rate']
X = df[['temp', 'humidity', 'pressure']]

# TODO: 添加截距项
X = sm.___(X)

# TODO: 拟合 OLS 回归
model = sm.___(y, X).fit()
print(model.summary())`,
      solutionKeywords: ['add_constant', 'OLS', 'fit'],
      hint: '关键：sm.add_constant(X) 添加截距；sm.OLS(y, X).fit() 拟合模型；查看 summary() 中 P>|t| < 0.05 的变量。'
    },
    quiz: [
      { question: '多元线性回归中，判断自变量是否显著的常用指标是？', options: ['R²值', 'p值 < 0.05', 'F统计量', '残差均值'], correctIndex: 1 },
      { question: '回归系数为负值意味着？', options: ['无显著影响', '该变量与良率负相关', '模型过拟合', '数据有缺失'], correctIndex: 1 },
      { question: 'OLS 回归的基本假设不包括？', options: ['残差正态分布', '自变量间无多重共线性', '因变量必须为二值变量', '同方差性'], correctIndex: 2 },
    ]
  }
};

function buildMission(s: ScenarioBase): MissionScenario | null {
  const data = MISSION_DATA[s.id];
  if (!data) return null;
  return { id: s.id, title: s.title, branch: s.branch, difficulty: s.difficulty, xpReward: s.xpReward, mission: s.mission, desc: s.desc, ...data };
}

/* ─── Icon map ──────────────────────────────────────────────────────── */
const IconMap: Record<string, React.ElementType> = {
  Zap, Star, Target, Brain, TrendingUp, Cpu, Database, Award
};

/* ─── Progress helpers ──────────────────────────────────────────────── */
const STORAGE_KEY = 'statlab-skill-progress';

function loadProgress(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveProgress(p: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
function loadXp(): number {
  try { return parseInt(localStorage.getItem('statlab-skill-xp') || '250', 10); } catch { return 250; }
}
function saveXp(xp: number) {
  localStorage.setItem('statlab-skill-xp', String(xp));
}

/* ─── SVG paths between nodes ───────────────────────────────────────── */
const NODE_W = 130, NODE_H = 150;
function buildPaths(scenarios: ScenarioBase[], progress: Record<string, boolean>) {
  const lines: { key: string; d: string; active: boolean; pending: boolean }[] = [];
  scenarios.forEach(s => {
    s.next?.forEach(tid => {
      const t = scenarios.find(n => n.id === tid);
      if (!t) return;
      const x1 = s.x + NODE_W / 2, y1 = s.y + NODE_H;
      const x2 = t.x + NODE_W / 2, y2 = t.y;
      const midY = (y1 + y2) / 2;
      lines.push({
        key: `${s.id}-${tid}`,
        d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
        active: !!progress[s.id],
        pending: !!progress[s.id] && !progress[tid],
      });
    });
  });
  return lines;
}

/* ─── Component ─────────────────────────────────────────────────────── */
const PracticalLabs: React.FC = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, boolean>>(loadProgress);
  const [xp, setXp] = useState<number>(loadXp);
  const [selected, setSelected] = useState<ScenarioBase>(SCENARIOS[2]);
  const [activeBranch, setActiveBranch] = useState<'all' | 'stats' | 'ml' | 'dl'>('all');
  const [missionNode, setMissionNode] = useState<MissionScenario | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [xpToast, setXpToast] = useState<{ xp: number; key: number } | null>(null);

  // Determine dynamic status for each node
  const getStatus = useCallback((s: ScenarioBase): NodeStatus => {
    const isAdmin = user?.username === 'admin' || user?.username === 'root';
    if (isAdmin) return progress[s.id] ? 'completed' : 'ready';
    
    if (progress[s.id]) return 'completed';
    if (s.id === 'data_basics') return 'ready';
    
    // Unlock if ALL immediate predecessors are completed
    const predecessors = SCENARIOS.filter(pred => pred.next?.includes(s.id));
    if (predecessors.length > 0 && predecessors.every(pred => progress[pred.id])) {
      return 'ready';
    }
    
    return 'locked';
  }, [user, progress]);

  const tier = getTier(xp);
  const nextTier = TIER_THRESHOLDS.find(t => t.min > xp);
  const completedCount = SCENARIOS.filter(s => getStatus(s) === 'completed').length;
  const progressPct = Math.round((completedCount / SCENARIOS.length) * 100);

  const handleComplete = (earnedXp: number, scenarioId: string) => {
    const newProgress = { ...progress, [scenarioId]: true };
    const newXp = xp + earnedXp;
    setProgress(newProgress);
    setXp(newXp);
    saveProgress(newProgress);
    saveXp(newXp);
    setXpToast({ xp: earnedXp, key: Date.now() });
    setMissionNode(null);
    setTimeout(() => setXpToast(null), 3200);
  };

  const paths = buildPaths(SCENARIOS, { ...progress, ...Object.fromEntries(SCENARIOS.filter(s => s.defaultStatus === 'completed').map(s => [s.id, true])) });

  const CANVAS_W = 1400, CANVAS_H = 820;

  return (
    <div className="page" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ background: 'var(--accent)', color: 'white', padding: 8, borderRadius: 12 }}>
              <Beaker size={22} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>技能实战树 · Industrial Skill Tree</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>完成节点任务解锁更高阶工业AI能力，积累 XP 晋升专家等级。</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* Branch filter */}
          <div style={{ display: 'flex', background: 'var(--bg-soft)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
            {(['all', 'stats', 'ml', 'dl'] as const).map(b => (
              <button key={b} onClick={() => setActiveBranch(b)} style={{
                padding: '5px 14px', borderRadius: 8, border: 'none', minHeight: 'unset',
                background: activeBranch === b ? 'var(--bg-raised)' : 'transparent',
                color: activeBranch === b ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase'
              }}>
                {b === 'all' ? '全部' : b === 'stats' ? '传统统计' : b === 'ml' ? '机器学习' : '深度学习'}
              </button>
            ))}
          </div>

          {/* XP + Tier */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--accent)', color: 'white', fontWeight: 800 }}>TIER {tier.tier}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{tier.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{xp} XP {nextTier ? `→ ${nextTier.min} 升级` : '· 顶级专家'} · 进度 {progressPct}%</div>
            <div style={{ width: 160, height: 5, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #ffcc00)', borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, flex: 1, minHeight: 0 }}>

        {/* Skill Tree Canvas */}
        <div className="skill-tree-container">
          <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, minWidth: '100%' }}>
            {/* Blueprint Grid Annotations */}
            <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#94a3b8', opacity: 0.7, pointerEvents: 'none' }}>
              <div>REF_FRAME: INDUST_PRO_01</div>
              <div>COORD_SYS: WGS-84_LAB</div>
              <div>SCALE_FCTR: 1.000000</div>
            </div>

            {/* SVG Paths */}
            <svg style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none' }}>
              {paths.map(p => (
                <path key={p.key} className={`skill-path${p.active ? ' active' : p.pending ? ' pending' : ''}`} d={p.d} />
              ))}
            </svg>

            {/* Tier labels (Refined for Blueprint) */}
            {[1, 2, 3].map(t => (
              <div key={t} style={{
                position: 'absolute', left: 16,
                top: t === 1 ? 60 : t === 2 ? 260 : 460,
                padding: '4px 8px',
                background: 'rgba(148, 163, 184, 0.1)',
                borderLeft: '2px solid #94a3b8',
                fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase',
                letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace',
                pointerEvents: 'none', zIndex: 10
              }}>LEVEL_0{t}</div>
            ))}

            {/* Nodes */}
            {SCENARIOS.map((s) => {
              const status = getStatus(s);
              const Icon = IconMap[s.icon] || Zap;
              const isDimmed = activeBranch !== 'all' && s.branch !== activeBranch;
              const isSelected = selected.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`hex-node ${status}${isSelected ? ' selected-node' : ''}`}
                  style={{ 
                    left: s.x, 
                    top: s.y, 
                    opacity: isDimmed ? 0.2 : 1, 
                    zIndex: isSelected ? 30 : 25,
                    pointerEvents: status === 'locked' ? 'none' : 'auto'
                  }}
                  onClick={(e) => { 
                    e.stopPropagation();
                    if (status !== 'locked') setSelected(s); 
                  }}
                >
                  <div className="hex-tier">T{s.tier}</div>
                  <div className="hex-icon"><Icon size={24} /></div>
                  <div className="hex-title">{s.title}</div>
                  
                  {/* Decorative node coordinates */}
                  <div style={{ position: 'absolute', bottom: 12, right: 28, fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', opacity: 0.5 }}>[{s.x},{s.y}]</div>

                  {status === 'completed' && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}><CheckCircle size={14} color="#10b981" /></div>
                  )}
                  {status === 'locked' && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}><Lock size={12} color="#94a3b8" /></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Detail Panel ── */}
        <div style={{ background: 'var(--bg-raised)', borderRadius: 20, border: '1px solid var(--border)', padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {(() => {
            const status = getStatus(selected);
            const diffColor = selected.difficulty === 'Master' ? '#a855f7' : selected.difficulty === 'Expert' ? '#8b5cf6' : selected.difficulty === 'Advanced' ? '#ef4444' : selected.difficulty === 'Intermediate' ? 'var(--accent)' : '#3b82f6';
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: `${diffColor}18`, color: diffColor, textTransform: 'uppercase' }}>
                    {selected.difficulty}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {selected.branch} · T{selected.tier}
                  </span>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{selected.title}</h2>

                <div style={{ padding: '8px 12px', background: 'rgba(255,154,0,0.08)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', marginBottom: 16, fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
                  {selected.mission}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 20 }}>{selected.desc}</p>

                {/* Skills */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>核心知识点</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.skills.map(sk => (
                      <span key={sk} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{sk}</span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {/* Meta info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-overlay)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>预计时间</div>
                      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Clock size={12} />{selected.duration}</div>
                    </div>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,154,0,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>获得 XP</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>+{selected.xpReward}</div>
                    </div>
                  </div>

                  {/* Prereq */}
                  <div style={{ padding: '10px 14px', background: 'var(--bg-overlay)', borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>解锁要求：</span>
                    <span style={{ color: 'var(--text-primary)' }}>{selected.requires}</span>
                  </div>

                  {/* CTA */}
                  {status === 'locked' ? (
                    <button className="btn" style={{ width: '100%', background: 'var(--bg-overlay)', color: 'var(--text-muted)', cursor: 'not-allowed', height: 46, borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Lock size={14} /> 前置任务未完成
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', height: 46, borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
                        onClick={() => {
                          const m = buildMission(selected);
                          if (m) setMissionNode(m);
                        }}
                      >
                        {status === 'completed' ? <><CheckCircle size={16} /> 重新回顾</> : <><Play size={16} /> 立即进入实战</>}
                      </button>
                      {status === 'completed' && (
                        <button
                          onClick={() => setShowCert(true)}
                          className="btn"
                          style={{ width: '100%', height: 40, borderRadius: 12, fontWeight: 700, background: 'rgba(255,154,0,0.08)', color: 'var(--accent)', border: '1px dashed var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Award size={14} /> 领取证书
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Modals ── */}
      {missionNode && (
        <SkillMissionModal
          scenario={missionNode}
          onClose={() => setMissionNode(null)}
          onComplete={(xpEarned) => handleComplete(xpEarned, missionNode.id)}
        />
      )}
      {showCert && (
        <CertificateModal
          userName="工业数据专家"
          courseTitle={selected.title}
          date={new Date().toLocaleDateString('zh-CN')}
          onClose={() => setShowCert(false)}
        />
      )}
      {xpToast && <XpToast key={xpToast.key} xp={xpToast.xp} visible label="任务完成！" />}
    </div>
  );
};

export default PracticalLabs;
