import React from 'react';
import { Target, Trophy, TrendingUp, Clock, Info, ShieldCheck, Zap } from 'lucide-react';

const ACTIVE_COMPETITIONS = [
  {
    id: 'comp_1',
    title: '大陆集团季度算法挑战：预测性分析（PMP）',
    prize: '🏆 ￥5,000 + 电子书券',
    prizeValue: '5,000',
    participants: 124,
    deadline: '2:14:24:08',
    status: 'ongoing',
    desc: '基于电机测试台架的生命周期数据，构建故障预测回归模型。'
  },
  {
    id: 'comp_2',
    title: '制造质量控制黑客马拉松 - 异常检测',
    prize: '🎁 Continental 运动背包',
    prizeValue: 'Gift',
    participants: 45,
    deadline: '0:06:12:35',
    status: 'ongoing',
    desc: '使用极度不平衡的数据集进行缺陷识别，F1-Score 排名。'
  }
];

const LEADERBOARD = [
  { name: 'Liang.Cheng01', score: 0.9842, rank: 1, avatar: '👤' },
  { name: 'Wang.Dan.Z04', score: 0.9715, rank: 2, avatar: '👤' },
  { name: 'Xiao.Chen.P02', score: 0.9542, rank: 3, avatar: '👤' },
  { name: 'Chen.Gang.G01', score: 0.9482, rank: 4, avatar: '👤' }
];

const Competitions: React.FC = () => {
  return (
    <div className="page" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: '#ff9a00', color: 'black', padding: 8, borderRadius: 12 }}>
              <Trophy size={24} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>算法竞赛 (Algorithm Competitions)</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>参与全球或内部算法挑战，在真实排名中验证你的 DS 实力。</p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>您的排名</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>未入榜</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>累积积分</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>120 pts</div>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        {/* Left: Active Comps */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>正在进行的挑战</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {ACTIVE_COMPETITIONS.map(comp => (
              <div key={comp.id} className="card animate-fade-in" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border)', background: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  height: 4, 
                  background: 'linear-gradient(90deg, #ff9a00, #ffc107)' 
                }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700 }}>Ongoing</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-raised)', color: 'var(--text-muted)', fontWeight: 600 }}>Continental Internal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>
                    <Clock size={14} /> {comp.deadline}
                  </div>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{comp.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>{comp.desc}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 16, marginBottom: 24, padding: 16, borderRadius: 12, background: 'var(--bg-raised)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>参赛人数</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{comp.participants} 位参赛</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>评估指标</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>RMSE / R²</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>最高奖项</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ff9a00' }}>{comp.prize}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '12px', borderRadius: 10, fontWeight: 700 }}>立即参加挑战</button>
                  <button className="btn btn-secondary" style={{ padding: '12px 24px', borderRadius: 10, fontWeight: 600 }}>查看榜单</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Leaderboard */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>全球排位榜</div>
          <div className="card" style={{ padding: 0, borderRadius: 20, border: '1px solid var(--border)', background: 'white', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: '#0f172a', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>积分榜前 10</span>
                <TrendingUp size={16} />
              </div>
            </div>
            <div>
              {LEADERBOARD.map((item, i) => (
                <div key={i} style={{ 
                  padding: '16px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 16, 
                  borderBottom: i === LEADERBOARD.length - 1 ? 'none' : '1px solid var(--border)',
                  background: i === 0 ? 'rgba(255,154,0,0.02)' : 'transparent' 
                }}>
                  <div style={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: '50%', 
                    background: i === 0 ? '#ff9a00' : i === 1 ? '#cbd5e1' : i === 2 ? '#fb923c' : 'transparent',
                    color: i < 3 ? 'black' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.avatar} {item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>大陆工号：***{Math.floor(Math.random()*1000)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{item.score}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>分数</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, textAlign: 'center', background: 'var(--bg-raised)' }}>
              <button className="btn-link-sm" style={{ padding: 4 }}>查看完整排名名单</button>
            </div>
          </div>

          <div className="card" style={{ marginTop: 24, padding: 20, background: 'rgba(37,99,235,0.03)', border: '1px dashed var(--accent)', borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <ShieldCheck size={20} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>反作弊系统已启动</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              本算法竞赛由 Continental IT 全球监控，系统会自动通过代码相似度检测和内核时间戳比对来防止作弊。请诚信竞赛。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Competitions;
