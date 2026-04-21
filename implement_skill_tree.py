import re

path = r"d:\statlab\deploy_bundle\client\src\PracticalLabs.tsx"

new_content = """import React, { useState } from 'react';
import { Beaker, ArrowRight, Play, Info, CheckCircle, Clock, Lock, Star, Zap, Target } from 'lucide-react';

const PRACTICAL_SCENARIOS = [
  {
    id: 'motor_vibration',
    x: 500, y: 100,
    title: '电机振动异常预警实战',
    icon: 'Zap',
    difficulty: 'Intermediate',
    duration: '30 min',
    desc: '处理时序振动信号，提取频域特征，训练异常检测模型以实现提前 2 小时故障预警。',
    skills: ['FFT 变换', 'Isolation Forest', '时序滑动窗口'],
    status: 'completed',
    next: ['yield_opt']
  },
  {
    id: 'yield_opt',
    x: 300, y: 350,
    title: 'A-Line 涂装产线良率根因分析',
    icon: 'Target',
    difficulty: 'Advanced',
    duration: '45 min',
    desc: '基于涂装车间 30 天的传感器数据，分析温度、湿度与涂层厚度对良率的影响，并找出最优工艺区间。',
    skills: ['多元逐步回归', '中继效应分析', '工艺参数优化'],
    status: 'ready',
    next: ['stock_demand']
  },
  {
    id: 'stock_demand',
    x: 700, y: 350,
    title: '物流仓库库存需求预测',
    icon: 'Star',
    difficulty: 'Expert',
    duration: '60 min',
    desc: '结合历史发货量与生产计划，构建多步时间序列预测模型，优化安全库存水平。',
    skills: ['Auto-ARIMA', 'XGBoost', '库存补货算法'],
    status: 'locked'
  }
];

const PracticalLabs: React.FC = () => {
  const [selected, setSelected] = useState(PRACTICAL_SCENARIOS[1]);

  const IconMap: any = { Zap, Star, Target };

  return (
    <div className="page" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'var(--accent)', color: 'white', padding: 8, borderRadius: 12 }}>
              <Beaker size={24} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>技能实战树 (Industrial Skill Tree)</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>完成节点任务以解锁更高阶的工业数据分析能力。</p>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>当前等级</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>LV.4 助理分析师</div>
            </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Skill Tree Canvas */}
        <div className="skill-tree-container">
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
            {PRACTICAL_SCENARIOS.map(s => (
                s.next?.map(nextId => {
                    const nextNode = PRACTICAL_SCENARIOS.find(n => n.id === nextId);
                    if (!nextNode) return null;
                    return (
                        <path 
                            key={`${s.id}-${nextId}`}
                            className={`skill-path ${s.status === 'completed' ? 'active' : ''}`}
                            d={`M ${s.x + 70} ${s.y + 80} L ${nextNode.x + 70} ${nextNode.y + 80}`}
                        />
                    );
                })
            ))}
          </svg>

          {PRACTICAL_SCENARIOS.map(s => {
            const Icon = IconMap[s.icon] || Zap;
            return (
              <div 
                key={s.id} 
                className={`hex-node ${s.status}`}
                style={{ left: s.x, top: s.y }}
                onClick={() => setSelected(s)}
              >
                <div className="hex-icon">
                    {s.status === 'locked' ? <Lock size={24} /> : <Icon size={24} />}
                </div>
                <div className="hex-title">{s.title.split(' ').join('\\n')}</div>
                {s.status === 'completed' && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <CheckCircle size={14} color="white" />
                    </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="card" style={{ padding: 24, borderRadius: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 20 }}>
             <span style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: 6, 
                background: selected.difficulty === 'Advanced' ? 'rgba(239,68,68,0.1)' : selected.difficulty === 'Expert' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                color: selected.difficulty === 'Advanced' ? '#ef4444' : selected.difficulty === 'Expert' ? '#a855f7' : '#3b82f6',
                textTransform: 'uppercase'
              }}>{selected.difficulty}</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, color: 'var(--text-muted)', fontSize: 13 }}>
               <Clock size={14} /> 预计耗时: {selected.duration}
            </div>
            
            {selected.status === 'locked' ? (
                <button className="btn" style={{ width: '100%', background: 'var(--bg-raised)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>
                    <Lock size={14} /> 前置任务未完成
                </button>
            ) : (
                <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {selected.status === 'completed' ? <><CheckCircle size={16} /> 重新回顾</> : <><Play size={16} /> 立即进入实战</>}
                </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PracticalLabs;
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("PracticalLabs.tsx transformed into Skill Tree")
