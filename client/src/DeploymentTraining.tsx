import React from 'react';
import { Rocket, Server, Activity, Terminal, Shield, RefreshCcw, Download, Info, Play, Pause, Trash2, Plus, Zap } from 'lucide-react';

const DEPLOYED_MODELS = [
  {
    id: 'm1',
    name: 'A-Line-Paint-Opt-v2.3',
    status: 'Running',
    version: '2.3.1',
    latency: '45ms',
    traffic: '1.2k req/min',
    uptime: '14d 2h',
    endpoint: '/api/v1/predict/paint-opt'
  },
  {
    id: 'm2',
    name: 'Vibration-Warning-IsolationForest',
    status: 'Paused',
    version: '1.0.4',
    latency: '--',
    traffic: '0 req/min',
    uptime: 'Paused',
    endpoint: '/api/v1/predict/vibration'
  }
];

const DeploymentTraining: React.FC = () => {
  return (
    <div className="page" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: '#22c55e', color: 'white', padding: 8, borderRadius: 12 }}>
              <Rocket size={24} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>部署实训 (Model Deployment & Serving)</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>将您的算法模型转化为工业级 API 服务。练习模型版本管理、流量监控与容错能力。</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> 部署新模型
        </button>
      </header>

      {/* Cluster Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32 }}>
        {[
          { label: '服务运行中', value: '1', icon: <Server size={20} color="#22c55e" />, bg: 'rgba(34,197,94,0.06)' },
          { label: '平均响应耗时', value: '45ms', icon: <Zap size={20} color="#ffb703" />, bg: 'rgba(255,183,3,0.06)' },
          { label: '后端实例', value: '4 / 4', icon: <Activity size={20} color="#2563eb" />, bg: 'rgba(37,99,235,0.06)' },
          { label: '系统状态', value: 'Healthy', icon: <Shield size={20} color="#22c55e" />, bg: 'rgba(34,197,94,0.06)' },
        ].map((stat, i) => (
          <div key={i} className="card animate-fade-in" style={{ padding: 20, borderRadius: 20, border: '1px solid var(--border)', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
              <Info size={14} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Model List Table */}
      <div className="card" style={{ padding: 0, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', background: 'white' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>已部署模型列表 (Deployed Models)</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-icon-only" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}><RefreshCcw size={14} /></button>
            <button className="btn-icon-only" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}><Terminal size={14} /></button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '16px 24px' }}>模型名称 / ID</th>
              <th style={{ padding: '16px' }}>状态</th>
              <th style={{ padding: '16px' }}>版本</th>
              <th style={{ padding: '16px' }}>平均耗时</th>
              <th style={{ padding: '16px' }}>吞吐量</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {DEPLOYED_MODELS.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                <td style={{ padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.endpoint}</div>
                </td>
                <td style={{ padding: '20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.status === 'Running' ? '#22c55e' : '#f59e0b' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: m.status === 'Running' ? '#22c55e' : '#f59e0b' }}>{m.status}</span>
                  </div>
                </td>
                <td style={{ padding: '20px 16px', fontSize: 13, fontWeight: 600 }}>v{m.version}</td>
                <td style={{ padding: '20px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.latency}</td>
                <td style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{m.traffic}</td>
                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {m.status === 'Running' ? (
                      <button className="btn-icon-only" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}><Pause size={14} /></button>
                    ) : (
                      <button className="btn-icon-only" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}><Play size={14} /></button>
                    )}
                    <button className="btn-icon-only" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}><Download size={14} /></button>
                    <button className="btn-icon-only" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Logs View Placeholder */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16 }}>实时访问日志 (Live Logs)</div>
        <div style={{ background: '#0f172a', borderRadius: 20, padding: '20px 24px', height: 240, overflowY: 'auto', fontFamily: '"Fira Code", monospace', fontSize: 12, color: '#94a3b8', border: '1px solid #1e293b' }}>
          <div>[2026-03-20 09:40:01] INFO | Initializing deployment worker...</div>
          <div>[2026-03-20 09:40:03] INFO | Loading model weights for A-Line-Paint-Opt-v2.3</div>
          <div>[2026-03-20 09:42:15] WARN | Traffic spike detected on endpoint /api/v1/predict/paint-opt</div>
          <div style={{ color: '#86efac' }}>[2026-03-20 09:45:00] POST | /api/v1/predict/paint-opt | 200 OK | Payload: (T:24.5, H:65.2, ...)</div>
          <div style={{ color: '#86efac' }}>[2026-03-20 09:45:10] POST | /api/v1/predict/paint-opt | 200 OK | Payload: (T:24.7, H:64.8, ...)</div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentTraining;
