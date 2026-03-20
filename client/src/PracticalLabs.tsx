import React from 'react';
import { Beaker, ArrowRight, Play, Info, CheckCircle, Clock } from 'lucide-react';

const PRACTICAL_SCENARIOS = [
  {
    id: 'yield_opt',
    title: 'A-Line 涂装产线良率根因分析',
    difficulty: 'Advanced',
    duration: '45 min',
    desc: '基于涂装车间 30 天的传感器数据，分析温度、湿度与涂层厚度对良率的影响，并找出最优工艺区间。',
    skills: ['多元逐步回归', '中继效应分析', '工艺参数优化'],
    status: 'ready'
  },
  {
    id: 'motor_vibration',
    title: '电机振动异常预警实战',
    difficulty: 'Intermediate',
    duration: '30 min',
    desc: '处理时序振动信号，提取频域特征，训练异常检测模型以实现提前 2 小时故障预警。',
    skills: ['FFT 变换', 'Isolation Forest', '时序滑动窗口'],
    status: 'completed'
  },
  {
    id: 'stock_demand',
    title: '物流仓库库存需求预测',
    difficulty: 'Expert',
    duration: '60 min',
    desc: '结合历史发货量与生产计划，构建多步时间序列预测模型，优化安全库存水平。',
    skills: ['Auto-ARIMA', 'XGBoost', '库存补货算法'],
    status: 'locked'
  }
];

const PracticalLabs: React.FC = () => {
  return (
    <div className="page" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ background: 'var(--accent)', color: 'white', padding: 8, borderRadius: 12 }}>
            <Beaker size={24} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>实操实验室 (Practical Labs)</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>进入真实的生产场景，利用平台算法解决实际业务挑战。每个实验室都基于脱敏的真实工业数据。</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
        {PRACTICAL_SCENARIOS.map(s => (
          <div key={s.id} className="card animate-fade-in" style={{ 
            padding: 24, 
            borderRadius: 20, 
            display: 'flex', 
            flexDirection: 'column',
            opacity: s.status === 'locked' ? 0.7 : 1,
            border: s.status === 'ready' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <span style={{ 
                fontSize: 10, 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: 6, 
                background: s.difficulty === 'Advanced' ? 'rgba(239,68,68,0.1)' : s.difficulty === 'Expert' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                color: s.difficulty === 'Advanced' ? '#ef4444' : s.difficulty === 'Expert' ? '#a855f7' : '#3b82f6'
              }}>{s.difficulty}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                <Clock size={12} /> {s.duration}
              </div>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>{s.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20, flex: 1 }}>{s.desc}</p>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>考察技能点</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.skills.map(sk => (
                  <span key={sk} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{sk}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {s.status === 'locked' ? (
                <button className="btn btn-secondary" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}>尚未解锁</button>
              ) : (
                <button className={`btn ${s.status === 'ready' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {s.status === 'ready' ? <><Play size={14} /> 立即开始</> : <><CheckCircle size={14} /> 重新回顾</>}
                </button>
              )}
              <button className="btn-icon-only" style={{ border: '1px solid var(--border)', background: 'transparent' }}>
                <Info size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '60px', padding: 40, borderRadius: 24, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ maxWidth: 600 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>自定义实操环境？</h2>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>如果您是专家级用户，可以上传您自己的业务数据集并选择一套评估模板，系统将自动为您生成一个定制化的实操挑战环境。</p>
        </div>
        <button className="btn" style={{ background: '#ff9a00', color: 'black', fontWeight: 700, padding: '12px 32px', borderRadius: 12 }}>立即定制</button>
      </div>
    </div>
  );
};

export default PracticalLabs;
