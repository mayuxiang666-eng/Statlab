import re

path = r"d:\statlab\deploy_bundle\client\src\App.tsx"

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add extra icons to imports
c = c.replace('PlayCircle, Loader2', 'PlayCircle, Loader2, Activity, ShieldCheck, GitBranch, TrendingUp, Info, Filter, ArrowRight')

# 2. Add "Health" tab to preview controls
# Target: <button className={`p-tab ${previewMode === "coding" ? 'active' : ''}`} onClick={() => setPreviewMode("coding")}>编码</button>
# Add after: <button className={`p-tab ${previewMode === "health" ? 'active' : ''}`} onClick={() => setPreviewMode("health")}>健康度</button>
c = c.replace('setPreviewMode("coding")}>编码</button>', 
              'setPreviewMode("coding")}>编码</button>\n                                <button className={`p-tab ${previewMode === "health" ? \'active\' : \'\'}`} onClick={() => setPreviewMode("health")}>健康度</button>')

# 3. Insert DataHealthView component logic
health_view_jsx = """
                            {previewMode === "health" ? (
                              <div className="data-health-grid">
                                <div className="health-score-card">
                                  <div className="health-label">Quality Score</div>
                                  <div className="health-gauge-val">92<span style={{ fontSize: 20, color: 'var(--text-muted)' }}>/100</span></div>
                                  <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <TrendingUp size={14} /> 极佳 (Excellent)
                                  </div>
                                  
                                  <div style={{ marginTop: 30 }}>
                                    {[
                                      { label: '完整度', val: 99.8, color: 'var(--success)' },
                                      { label: '一致性', val: 94.2, color: 'var(--accent)' },
                                      { label: '有效性', val: 88.5, color: '#ff9a00' }
                                    ].map(m => (
                                      <div key={m.label} style={{ marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                                          <span style={{ fontWeight: 700 }}>{m.val}%</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
                                          <div style={{ width: `${m.val}%`, height: '100%', background: m.color }}></div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                  <div className="card" style={{ margin: 0, padding: 20 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Activity size={16} color="var(--accent)" /> 关键特征分布 (Feature Distributions)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                      {activeVersion?.columns.slice(0, 3).map(col => (
                                        <div key={col.name} style={{ background: 'var(--bg-soft)', padding: 12, borderRadius: 12 }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>{col.name}</div>
                                          <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                                            {[40, 70, 90, 100, 80, 50, 30].map((h, i) => (
                                              <div key={i} className="distribution-mini-bar" style={{ height: `${h}%`, opacity: 0.3 + (h/100)*0.7 }}></div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="card" style={{ margin: 0, padding: 20, flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <GitBranch size={16} color="var(--purple)" /> 数据系谱与血缘 (Provenance)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '20px 0' }}>
                                      <div className="provenance-node">
                                        <div style={{ width: 44, height: 44, background: 'var(--bg-raised)', borderRadius: 8, display: 'flex', alignItems: 'center', justify-content: 'center' }}>
                                          <Database size={20} color="var(--accent)" />
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>MES_Export</div>
                                      </div>
                                      <div className="provenance-line"></div>
                                      <div className="provenance-node">
                                        <div style={{ width: 36, height: 36, border: '1px dashed var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justify-content: 'center' }}>
                                          <Filter size={14} color="var(--text-secondary)" />
                                        </div>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>清洗</div>
                                      </div>
                                      <div className="provenance-line"></div>
                                      <div className="provenance-node">
                                        <div style={{ width: 44, height: 44, background: 'rgba(255,154,0,0.1)', border: '1px solid var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justify-content: 'center' }}>
                                          <ShieldCheck size={20} color="var(--accent)" />
                                        </div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>当前版本 V{activeVersion?.version}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="data-table-wrap" style={{ border: 'none', borderRadius: 0 }} ref={previewWrapRef} onScroll={syncPreviewScrollMeta}>
"""
# This is tricky because I need to find the specific <table> block.
# I'll target the <div className="data-table-wrap" ... ref={previewWrapRef}> line.
c = c.replace('<div className="data-table-wrap" style={{ border: \'none\', borderRadius: 0 }} ref={previewWrapRef} onScroll={syncPreviewScrollMeta}>', 
              health_view_jsx)

# 4. Closing the conditional blocks correctly.
# The previous replace opened a ( ... ? ( ... ) : ( ... )) block.
# I need to add the closing ) for the ternary and the </div> for the wrapper if appropriate.
# Actually, the original line was:
# <div className="data-table-wrap" ...> ... </div>
# My new block has:
# {previewMode === "health" ? ( ... ) : ( <div className="data-table-wrap" ...> ... </div> )}

# Let's target the </table> wrapper closing tag.
c = c.replace('</table>\n                            </div>', 
              '</table>\n                            </div>\n                            )}')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(c)

print("App.tsx updated with Data Health & Lineage")
