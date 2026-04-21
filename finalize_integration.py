import re

# 1. Integrate Certificate into PracticalLabs.tsx
path_labs = r"d:\statlab\deploy_bundle\client\src\PracticalLabs.tsx"
with open(path_labs, 'r', encoding='utf-8') as f:
    labs_content = f.read()

labs_content = "import CertificateModal from './components/CertificateModal';\n" + labs_content

certificate_state = """  const [showCert, setShowCert] = useState(false);
  const [activeBranch, setActiveBranch] = useState<'all' | 'stats' | 'ml' | 'dl'>('all');"""

labs_content = labs_content.replace("const [activeBranch, setActiveBranch] = useState<'all' | 'stats' | 'ml' | 'dl'>('all');", certificate_state)

certificate_button = """            {selected.status === 'completed' && (
                <button 
                    onClick={() => setShowCert(true)}
                    className="btn" 
                    style={{ width: '100%', height: 48, borderRadius: 12, fontWeight: 700, marginTop: 12, background: 'rgba(255,154,0,0.1)', color: 'var(--accent)', border: '1px dashed var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                    <Award size={16} /> 领取工业分析师证书
                </button>
            )}"""

labs_content = labs_content.replace("{selected.status === 'completed' ? <><CheckCircle size={16} /> 重新回顾</> : <><Play size={16} /> 立即进入实战</>}\n                </button>", 
                                    "{selected.status === 'completed' ? <><CheckCircle size={16} /> 重新回顾</> : <><Play size={16} /> 立即进入实战</>}\n                </button>\n" + certificate_button)

labs_footer = """      <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      
      {showCert && (
          <CertificateModal 
            userName="工业数据专家" 
            courseTitle={selected.title} 
            date={new Date().toLocaleDateString()} 
            onClose={() => setShowCert(false)} 
          />
      )}
    </div>"""

labs_content = labs_content.replace("""      <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>""", labs_footer)

with open(path_labs, 'w', encoding='utf-8') as f:
    f.write(labs_content)


# 2. Implement Code Generator in App.tsx
path_app = r"d:\statlab\deploy_bundle\client\src\App.tsx"
with open(path_app, 'r', encoding='utf-8') as f:
    app_content = f.read()

generator_fn = """
  const exportToPythonLab = () => {
    if (!selectedAlgo || !activeVersion) return;
    
    let code = `# StatLab 自动生成的分析代码\\n# 算法: ${selectedAlgo.name}\\n# 数据集: ${activeVersion.datasetId}\\n\\nimport pandas as pd\\nimport numpy as np\\n`;
    
    if (selectedAlgo.id.includes('correlation')) {
        const vars = assignments['variables'] || [];
        code += `\\n# 相关性分析\\nimport seaborn as sns\\nimport matplotlib.pyplot as plt\\n\\ndf = pd.read_csv('data.csv')\\nsubset = df[${JSON.stringify(vars)}]\\ncorr = subset.corr()\\nprint(corr)\\n\\nsns.heatmap(corr, annot=True)\\nplt.show()\\n`;
    } else if (selectedAlgo.id.includes('regression')) {
        const target = assignments['target']?.[0];
        const features = assignments['features'] || [];
        code += `\\n# 线性回归分析\\nimport statsmodels.api as sm\\n\\ndf = pd.read_csv('data.csv')\\ny = df['${target}']\\nX = df[${JSON.stringify(features)}]\\nX = sm.add_constant(X)\\n\\nmodel = sm.OLS(y, X).fit()\\nprint(model.summary())\\n`;
    } else {
        code += `\\n# TODO: 实现 ${selectedAlgo.name} 的具体逻辑\\npresent_vars = ${JSON.stringify(assignments)}\\nprint("已分配变量:", present_vars)\\n`;
    }

    setPendingCourseId(undefined); // Clear course context
    // We need to pass this code to PythonLab. 
    // For now, we'll store it in localStorage and PythonLab will pick it up on mount.
    localStorage.setItem('statlab_python_export', code);
    setPage('python-lab');
    addLog('info', '已导出配置到 Python Lab');
  };
"""

# Find place to insert the function (after other page-related states)
app_content = app_content.replace("  const autoImportingRef = useRef(false);", generator_fn + "\n  const autoImportingRef = useRef(false);")

# Add the button in the Workspace Header
export_btn = """<div className="workspace-title">
                                {selectedAlgo.name}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost btn-xs" onClick={exportToPythonLab} style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 10, border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px' }}>🚀 导出 Python 代码</button>
                                    <button className="btn btn-ghost btn-xs" title="查看帮助" style={{ borderRadius: "50%", width: 24, height: 24, padding: 0 }}>?</button>
                                </div>
                              </div>"""

app_content = app_content.replace("""<div className="workspace-title">
                                {selectedAlgo.name}
                                <button className="btn btn-ghost btn-xs" title="查看帮助" style={{ borderRadius: "50%", width: 24, height: 24, padding: 0 }}>?</button>
                              </div>""", export_btn)

with open(path_app, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Integration complete: Certificate and Code Generator added.")
