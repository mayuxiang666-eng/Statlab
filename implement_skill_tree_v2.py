import re

path = r"d:\statlab\deploy_bundle\client\src\PracticalLabs.tsx"

new_content = """import React, { useState } from 'react';
import { Beaker, ArrowRight, Play, Info, CheckCircle, Clock, Lock, Star, Zap, Target, BookOpen, Brain } from 'lucide-react';

const PRACTICAL_SCENARIOS = [
  {
    id: 'motor_vibration',
    x: 500, y: 70,
    title: '电机振动异常预警实战',
    icon: 'Zap',
    difficulty: 'Intermediate',
    duration: '30 min',
    branch: 'ml',
    requires: '基础 Python',
    desc: '处理时序振动信号，提取频域特征，训练异常检测模型以实现提前 2 小时故障预警。',
    skills: ['FFT 变换', 'Isolation Forest', '时序滑动窗口'],
    status: 'completed',
    next: ['yield_opt', 'deep_fault']
  },
  {
    id: 'yield_opt',
    x: 300, y: 280,
    title: 'A-Line 涂装产线良率根因分析',
    icon: 'Target',
    difficulty: 'Advanced',
    duration: '45 min',
    branch: 'stats',
    requires: '线性回归基础',
    desc: '基于涂装车间 30 天的传感器数据，分析温度、湿度与涂层厚度对良率的影响，并找出最优工艺区间。',
    skills: ['多元逐步回归', '中继效应分析', '工艺参数优化'],
    status: 'ready',
    next: ['stock_demand']
  },
  {
    id: 'deep_fault',
    x: 700, y: 280,
    title: '基于 CNN 的轴承损伤分类',
    icon: 'Brain',
    difficulty: 'Advanced',
    duration: '50 min',
    branch: 'dl',
    requires: '神经网络基础',
    desc: '将振动信号转化为格拉姆角场图像，利用卷积神经网络进行高精度损伤等级分类。',
    skills: ['信号图像化', 'CNN 架构', '模型轻量化'],
    status: 'locked'
  },
  {
    id: 'stock_demand',
    x: 500, y: 490,
    title: '物流仓库库存需求预测',
    icon: 'Star',
    difficulty: 'Expert',
    duration: '60 min',
    branch: 'stats',
    requires: '时间序列基础',
    desc: '结合历史发货量与生产计划，构建多步时间序列预测模型，优化安全库存水平。',
    skills: ['Auto-ARIMA', 'XGBoost', '库存补货算法'],
    status: 'locked'
  }
];

const PracticalLabs: React.FC = () => {
  const [selected, setSelected] = useState(PRACTICAL_SCENARIOS[1]);
  const [hovered, setHovered] = useState<any>(null);
  const [activeBranch, setActiveBranch] = useState<'all' | 'stats' | 'ml' | 'dl'>('all');

  const IconMap: any = { Zap, Star, Target, Brain };

  return (
    <div className="page" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'var(--accent)', color: 'white', padding: 8, borderRadius: 12 }}>
              <Beaker size={24} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>技能实战树 (Industrial Skill Tree)</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>完成节点任务以解锁更高阶的工业数据分析能力。</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', background: 'var(--bg-soft)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
                {['all', 'stats', 'ml', 'dl'].map(b => (
                    <button 
                        key={b}
                        onClick={() => setActiveBranch(b as any)}
                        style={{ 
                            padding: '6px 16px', 
                            borderRadius: 8, 
                            border: 'none', 
                            background: activeBranch === b ? 'var(--bg-raised)' : 'transparent',
                            color: activeBranch === b ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        {b === 'all' ? '全部' : b === 'stats' ? '传统统计' : b === 'ml' ? '机器学习' : '深度学习'}
                    </button>
                ))}
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>当前进度: 25%</div>
                <div style={{ width: 120, height: 4, background: 'var(--bg-soft)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: '25%', height: '100%', background: 'var(--accent)' }}></div>
                </div>
            </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Skill Tree Canvas */}
        <div className="skill-tree-container" style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
            {PRACTICAL_SCENARIOS.map(s => (
                s.next?.map(nextId => {
                    const nextNode = PRACTICAL_SCENARIOS.find(n => n.id === nextId);
                    if (!nextNode) return null;
                    const isActive = (activeBranch === 'all' || s.branch === activeBranch || nextNode.branch === activeBranch);
                    return (
                        <path 
                            key={`${s.id}-${nextId}`}
                            className={`skill-path ${s.status === 'completed' ? 'active' : ''}`}
                            style={{ opacity: isActive ? 1 : 0.1 }}
                            d={`M ${s.x + 70} ${s.y + 80} L ${nextNode.x + 70} ${nextNode.y + 80}`}
                        />
                    );
                })
            ))}
          </svg>

          {PRACTICAL_SCENARIOS.map(s => {
            const Icon = IconMap[s.icon] || Zap;
            const isDimmed = activeBranch !== 'all' && s.branch !== activeBranch;
            return (
              <div 
                key={s.id} 
                className={`hex-node ${s.status}`}
                style={{ left: s.x, top: s.y, opacity: isDimmed ? 0.3 : 1 }}
                onClick={() => setSelected(s)}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="hex-icon">
                    {s.status === 'locked' ? <Lock size={24} /> : <Icon size={24} />}
                </div>
                <div className="hex-title">{s.title.replace(' ', '\\n')}</div>
                {s.status === 'completed' && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <CheckCircle size={14} color="white" />
                    </div>
                )}
              </div>
            );
          })}

          {/* Hover Preview Card */}
          {hovered && (
              <div style={{ 
                  position: 'absolute', 
                  left: hovered.x + 150, 
                  top: hovered.y + 20, 
                  width: 200, 
                  background: 'var(--bg-raised)', 
                  border: '1px solid var(--accent)', 
                  borderRadius: 12, 
                  padding: 16, 
                  zIndex: 100,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                  animation: 'fadeIn 0.2s ease-out'
              }}>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>{hovered.branch} 分支</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>{hovered.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {hovered.duration}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={12} /> {hovered.requires}</div>
                  </div>
              </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="card" style={{ padding: 24, borderRadius: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
             <span style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: 6, 
                background: selected.difficulty === 'Advanced' ? 'rgba(239,68,68,0.1)' : selected.difficulty === 'Expert' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                color: selected.difficulty === 'Advanced' ? '#ef4444' : selected.difficulty === 'Expert' ? '#a855f7' : '#3b82f6',
                textTransform: 'uppercase'
              }}>{selected.difficulty}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.branch}</span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{selected.title}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>{selected.desc}</p>
          
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>核心知识点</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.skills.map(sk => (
                <span key={sk} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{sk}</span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>解锁要求</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.requires}</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, color: 'var(--text-muted)', fontSize: 13 }}>
               <Clock size={14} /> 预计通过时间: {selected.duration}
            </div>
            
            {selected.status === 'locked' ? (
                <button className="btn" style={{ width: '100%', background: 'var(--bg-soft)', color: 'var(--text-muted)', cursor: 'not-allowed', height: 48 }}>
                    <Lock size={14} /> 前置任务未完成
                </button>
            ) : (
                <button className="btn btn-primary" style={{ width: '100%', height: 48, borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {selected.status === 'completed' ? <><CheckCircle size={16} /> 重新回顾</> : <><Play size={16} /> 立即进入实战</>}
                </button>
            )}
          </div>
        </div>

      </div>
      <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default PracticalLabs;
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("PracticalLabs.tsx updated with Branching and Hover Support")
