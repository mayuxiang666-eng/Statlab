import re

path = r"d:\statlab\deploy_bundle\client\src\MLWorkspace.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Recommendation Logic
recom_logic = """
    // AI Algorithm Recommendation Logic
    const recommendedAlgoIds = useMemo(() => {
        if (!activeVersion) return new Set<string>();
        const ids = new Set<string>();
        const cols = activeVersion.columns || [];
        const hasTimeSeries = cols.some(c => ['date', 'time', 'ts', 'year', 'month', 'timestamp', '日期', '时间'].some(k => c.name.toLowerCase().includes(k)));
        const isSmallData = activeVersion.rowCount < 500;
        const isComplex = cols.length > 20;

        if (hasTimeSeries) {
            ids.add('ml.arima'); 
            ids.add('ml.prophet');
        }
        if (isSmallData) {
            ids.add('ml.ridge');
            ids.add('ml.logistic');
            ids.add('ml.lasso');
        } else {
            ids.add('ml.xgboostReg');
            ids.add('ml.randomForest');
        }
        if (isComplex) {
            ids.add('ml.pca');
            ids.add('ml.lightgbmReg');
        }
        return ids;
    }, [activeVersion]);
"""

# Insert recommendations after mlAlgosBySub
content = content.replace("    const mlAlgosBySub = useMemo(() => {", recom_logic + "\n    const mlAlgosBySub = useMemo(() => {")

# 2. Update Sidebar UI to show "✨ AI Suggested"
sidebar_item_search = """                                    <div>{algo.name}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{algo.description}</div>"""

sidebar_item_replace = """                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {algo.name}
                                        {recommendedAlgoIds.has(algo.id) && (
                                            <span style={{ 
                                                fontSize: 9, padding: '1px 5px', borderRadius: 4, 
                                                background: 'var(--accent)', color: 'white', fontWeight: 800,
                                                animation: 'pulse-glance 2s infinite'
                                            }}>✨ AI 建议</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{algo.description}</div>"""

content = content.replace(sidebar_item_search, sidebar_item_replace)

# 3. Add Leaderboard State and Logic
leaderboard_state = """    const [leaderboard, setLeaderboard] = useState<Record<string, any[]>>({}); // datasetId -> results[]"""
content = content.replace("    const [hasStartedTraining, setHasStartedTraining] = useState(false);", "    const [hasStartedTraining, setHasStartedTraining] = useState(false);\n" + leaderboard_state)

# 4. Save results to leaderboard on success
leaderboard_push = """            pushLog("success", `✅ [${selectedAlgo.name}] 训练完成！`);
            
            // Push to leaderboard
            setLeaderboard(prev => {
                const dsId = activeVersion.id;
                const current = prev[dsId] || [];
                const metrics = data.extras?.regression?.metrics || data.extras?.classification?.metrics || {};
                const entry = {
                    algoName: selectedAlgo.name,
                    ts: nowStr(),
                    ...metrics
                };
                return { ...prev, [dsId]: [entry, ...current].slice(0, 10) };
            });"""

content = content.replace('            pushLog("success", `✅ [${selectedAlgo.name}] 训练完成！`);', leaderboard_push)

# 5. Add pulse-glance animation
content += """
<style>{`
  @keyframes pulse-glance {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
  }
`}</style>
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("MLWorkspace.tsx updated with Recommendations and Leaderboard foundational logic.")
