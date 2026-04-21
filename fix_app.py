import re
path = r"d:\statlab\deploy_bundle\client\src\App.tsx"
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Fix Imports (if not already renamed)
if 'Database,' in c and 'DbIcon' not in c:
    c = c.replace('Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4', 
                   'Database as DbIcon, FileText, Upload, Plus, Download, Trash2, Table, BarChart4, Cpu, Zap, Layers, PlayCircle, Loader2')

# Add Running Tasks (if not already added)
if 'Running Tasks Section' not in c:
    running_section = """
                        {/* Running Tasks Section */}
                        {runHistory.some(r => r.status === 'running') && (
                          <div style={{ marginBottom: 30 }}>
                            <div className="section-head" style={{ marginBottom: 16, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Loader2 className="animate-spin" size={16} color="var(--accent)" /> 运行中的任务 (Running)
                            </div>
                            <div className="card" style={{ borderRadius: 16, padding: 20, border: '1px solid var(--accent-dim)', background: 'rgba(255,154,0,0.02)' }}>
                              {runHistory.filter(r => r.status === 'running').map((r, i) => (
                                <div key={i} style={{ marginBottom: i === runHistory.filter(r => r.status === 'running').length - 1 ? 0 : 20 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.algoName || r.algoId}</div>
                                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>处理中...</div>
                                  </div>
                                  <div className="progress-container">
                                    <div className="progress-bar-fill animate" style={{ width: '65%' }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
"""
    target = '<div className="section-head" style={{ marginBottom: 16, fontSize: 16 }}>🕰️ 最近活跃</div>'
    if target in c:
        c = c.replace(target, running_section + '\n                        ' + target)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(c)

print("Done")
