import React, {
    useState, useEffect, useRef, useCallback, useMemo
} from "react";
import axios from "axios";
import * as echarts from "echarts";
import {
    AlgorithmSpec, AnalysisResult, DatasetVersionMeta, InputSlotSpec
} from "@statlab/shared";
import {
    DndContext, PointerSensor, useSensor, useSensors,
    DragEndEvent, useDraggable, useDroppable
} from "@dnd-kit/core";

import { Language, t } from "./locales";

// ─── Types ─────────────────────────────────────────────────────────────────────
type LogEntry = { ts: string; level: "info" | "success" | "warn" | "error"; msg: string };
type MLResult = AnalysisResult & { trainingLogs?: string[]; runId?: number };
type MLPage = "builder" | "result";

interface Props {
    algorithms: AlgorithmSpec[];
    activeVersion: (DatasetVersionMeta & { datasetId: any }) | null;
    datasets: any[];
    onSelectDataset: (id: any) => void;
    addLog: (level: "info" | "success" | "warn" | "error", msg: string) => void;
    lang: Language;
}

function nowStr() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

// ─── ML Workspace Root ──────────────────────────────────────────────────────────
export default function MLWorkspace({ algorithms, activeVersion, datasets, lang, onSelectDataset, addLog }: Props) {
    const mlAlgos = useMemo(() => algorithms.filter(a => a.category === "ml"), [algorithms]);
    const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmSpec | null>(null);
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});
    const [params, setParams] = useState<Record<string, unknown>>({});
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<MLResult | null>(null);
    const [mlPage, setMlPage] = useState<MLPage>("builder");
    const [logs, setLogs] = useState<LogEntry[]>([{ ts: nowStr(), level: "info", msg: t(lang, "ml", "trainingLog") + " " + (lang === "zh" ? "已就绪" : "Ready") }]);
    const [algoSearch, setAlgoSearch] = useState("");
    const [varSearch, setVarSearch] = useState("");
    const [resTab, setResTab] = useState<"output" | "charts" | "logs">("output");
    const [runId, setRunId] = useState<number | null>(null);
    const [analysisName, setAnalysisName] = useState("");
    const [analystName, setAnalystName] = useState("");
    const [hasStartedTraining, setHasStartedTraining] = useState(false);

    const logCount = useRef(0);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const onDrop = (event: DragEndEvent) => {
        const name = event.active.id as string;
        const slotId = event.over?.id as string | undefined;
        if (!slotId || !selectedAlgo || !activeVersion) return;
        const slot = selectedAlgo.inputSpec.find((s: any) => s.id === slotId);
        const varType = activeVersion.columns.find((c: any) => c.name === name)?.type;
        if (!slot || !varType) return;
        if (!slot.acceptedTypes.includes(varType)) {
            pushLog("warn", `"${name}" 类型 ${varType} 不匹配槽位 ${slot.label}`);
            return;
        }
        setAssignments(prev => {
            const ex = prev[slotId] || [];
            if (ex.includes(name)) return prev;
            const max = typeof slot.max === "number" ? slot.max : Infinity;
            if (ex.length >= max) return prev;
            return { ...prev, [slotId]: [...ex, name] };
        });
    };

    // Auto scroll logs to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Live log stream via SSE
    useEffect(() => {
        const es = new EventSource("/api/logs/stream");
        es.onmessage = (ev) => {
            try {
                const payload = JSON.parse(ev.data);
                if (!payload?.msg) return;
                setLogs(prev => [...prev, { ts: nowStr(), level: "info", msg: payload.msg }]);
            } catch (err) {
                console.warn("SSE parse error", err);
            }
        };
        es.onerror = () => {
            es.close();
        };
        return () => es.close();
    }, []);

    const pushLog = useCallback((level: LogEntry["level"], msg: string) => {
        setLogs(p => [...p, { ts: nowStr(), level, msg }]);
        logCount.current++;
    }, []);

    const mlAlgosBySub = useMemo(() => {
        const m = new Map<string, AlgorithmSpec[]>();
        const filtered = mlAlgos.filter(a => !algoSearch || [a.name, a.description, a.id].some(s => s.includes(algoSearch)));
        const subOrder = { "regression": 0, "classification": 1, "clustering": 2, "diagnosis": 3, "prep": 4 };
        const sorted = [...filtered].sort((a, b) => (subOrder[a.subcategory as keyof typeof subOrder] ?? 99) - (subOrder[b.subcategory as keyof typeof subOrder] ?? 99));
        sorted.forEach(a => { const arr = m.get(a.subcategory) || []; arr.push(a); m.set(a.subcategory, arr); });
        return m;
    }, [mlAlgos, algoSearch]);

    const subLabels: Record<string, string> = {
        regression: t(lang, "ml", "regression"),
        classification: t(lang, "ml", "classification"),
        clustering: lang === "zh" ? "🔵 聚类分析" : lang === "de" ? "🔵 Clustering" : "🔵 Clustering",
        diagnosis: lang === "zh" ? "🩺 工业诊断" : lang === "de" ? "🩺 Diagnose" : "🩺 Diagnosis",
        prep: lang === "zh" ? "⚙️ 数据准备" : lang === "de" ? "⚙️ Vorbereitung" : "⚙️ Prep"
    };


    const handleSelectAlgo = (algo: AlgorithmSpec) => {
        setSelectedAlgo(algo);
        setAssignments({});
        setResult(null);
        setRunId(null);
        setHasStartedTraining(false);
        setLogs([{ ts: nowStr(), level: "info", msg: `🔧 已选择算法: ${algo.name}` }]);
        // Set default params
        const defaultParams: Record<string, unknown> = {};
        algo.paramSchema.forEach(p => { defaultParams[p.key] = p.default; });
        setParams(defaultParams);
        pushLog("info", `📋 配置参数: ${algo.paramSchema.map(p => `${p.label}=${p.default}`).join(", ")}`);
    };

    const isRunReady = selectedAlgo && activeVersion && selectedAlgo.inputSpec.every(
        s => (assignments[s.id] || []).length >= s.min
    );

    const run = async () => {
        if (!selectedAlgo || !activeVersion) return;
        setRunning(true);
        setHasStartedTraining(true);
        setResult(null);
        setMlPage("result");
        setResTab("logs");
        pushLog("info", `🚀 开始运行 [${selectedAlgo.name}]...`);
        pushLog("info", `📦 数据集: ${activeVersion.rowCount} 行 × ${activeVersion.columns.length} 列`);
        pushLog("info", `⚙️ 参数: ${JSON.stringify(params)}`);

        try {
            const { data } = await axios.post<MLResult>("/api/run", {
                datasetVersionId: activeVersion.id,
                algorithmId: selectedAlgo.id,
                variables: assignments,
                params,
                analysisName: analysisName.trim() || undefined,
                analystName: analystName.trim() || undefined
            });
            setResult(data);
            setRunId((data as any)?.runId ?? null);
            // Push training logs returned from backend
            if (data.trainingLogs && data.trainingLogs.length > 0) {
                data.trainingLogs.forEach(l => {
                    const level = l.includes("完成") || l.includes("训练完成") ? "success" : "info";
                    setLogs(prev => [...prev, { ts: nowStr(), level, msg: l }]);
                });
            }
            pushLog("success", `✅ [${selectedAlgo.name}] 训练完成！`);
            setResTab("output");
            addLog("success", `机器学习 [${selectedAlgo.name}] 完成`);
        } catch (err: any) {
            const msg = err?.response?.data?.error || String(err);
            pushLog("error", `❌ 运行失败: ${msg}`);
            addLog("error", `ML 运行失败: ${msg}`);
            setRunId(null);
        } finally {
            setRunning(false);
        }
    };

    const filteredVars = useMemo(() => {
        const cols = activeVersion?.columns || [];
        return varSearch ? cols.filter(c => c.name.toLowerCase().includes(varSearch.toLowerCase())) : cols;
    }, [activeVersion?.columns, varSearch]);

    return (
        <div className="ml-shell ml-stage">
            {/* ── Left Sidebar: Algo List ── */}
            <div className="ml-algo-panel">
                <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>🤖</span> 算法库
                        <label style={{ marginLeft: "auto", cursor: "pointer", fontSize: 11, padding: "3px 8px", background: "var(--bg-raised)", borderRadius: 5, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 4 }}>
                            📥 导入模型
                            <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    try {
                                        const data = JSON.parse(ev.target?.result as string);
                                        if (data.type !== "statlab-model" || !data.algoId) throw new Error("无效的模型文件");
                                        const a = mlAlgos.find(x => x.id === data.algoId);
                                        if (!a) throw new Error("无法匹配算法: " + data.algoId);
                                        setSelectedAlgo(a);
                                        setResult(data.result);
                                        setParams(data.params || {});
                                        setAssignments(data.assignments || {});
                                        if (data.logs) setLogs(data.logs);
                                        setResTab("output");
                                        setMlPage("result");
                                        pushLog("success", `📥 已成功载入模型 [${a.name}]`);
                                    } catch (err: any) { pushLog("error", "文件解析失败: " + err.message); }
                                    e.target.value = "";
                                };
                                reader.readAsText(file);
                            }} />
                        </label>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🔍</span>
                        <input value={algoSearch} onChange={e => setAlgoSearch(e.target.value)}
                            placeholder="搜索算法..."
                            style={{ border: "none", background: "none", outline: "none", fontSize: 12, color: "var(--text-primary)", width: "100%" }} />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", minHeight: 0 }}>
                    {Array.from(mlAlgosBySub.entries()).map(([sub, algos]) => (
                        <div key={sub}>
                            <div style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                                {subLabels[sub] || sub}
                            </div>
                            {algos.map(algo => (
                                <div key={algo.id}
                                    onClick={() => handleSelectAlgo(algo)}
                                    style={{
                                        padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                                        color: selectedAlgo?.id === algo.id ? "var(--accent)" : "var(--text-primary)",
                                        background: selectedAlgo?.id === algo.id ? "var(--accent-dim)" : "transparent",
                                        borderLeft: selectedAlgo?.id === algo.id ? "3px solid var(--accent)" : "3px solid transparent",
                                        transition: "all 0.15s"
                                    }}>
                                    <div>{algo.name}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{algo.description}</div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Main Area ── */}
            <div className="ml-main">
                {!selectedAlgo ? (
                    <MLWelcome onSelectAlgo={handleSelectAlgo} mlAlgos={mlAlgos} lang={lang} />
                ) : mlPage === "builder" ? (
                    <DndContext sensors={sensors} onDragEnd={onDrop}>
                        <MLBuilder
                            algo={selectedAlgo}
                            activeVersion={activeVersion}
                            assignments={assignments}
                            setAssignments={setAssignments}
                            params={params}
                            setParams={setParams}
                            isRunReady={!!isRunReady}
                            running={running}
                            onRun={run}
                            onReset={() => {
                                setAssignments({});
                                setResult(null);
                                setAnalysisName("");
                                setAnalystName("");
                                setHasStartedTraining(false);
                                setLogs([{ ts: nowStr(), level: "info", msg: "🔄 " + (lang === "zh" ? "已重置配置" : "Configuration reset") }]);
                            }}
                            onViewResult={() => setMlPage("result")}
                            hasResult={!!result}
                            logs={logs}
                            logsEndRef={logsEndRef}
                            filteredVars={filteredVars}
                            varSearch={varSearch}
                            setVarSearch={setVarSearch}
                            datasets={datasets}
                            onSelectDataset={onSelectDataset}
                            analysisName={analysisName}
                            setAnalysisName={setAnalysisName}
                            analystName={analystName}
                            setAnalystName={setAnalystName}
                            hasStartedTraining={hasStartedTraining}
                            lang={lang}
                        />
                    </DndContext>
                ) : (
                    <MLResultView
                        result={result}
                        algo={selectedAlgo}
                        resTab={resTab}
                        setResTab={setResTab}
                        logs={logs}
                        logsEndRef={logsEndRef}
                        onBack={() => setMlPage("builder")}
                        running={running}
                        params={params}
                        assignments={assignments}
                        runId={runId}
                        lang={lang}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────────
function MLWelcome({ onSelectAlgo, mlAlgos, lang }: { onSelectAlgo: (a: AlgorithmSpec) => void; mlAlgos: AlgorithmSpec[]; lang: Language }) {
    const featured = [
        { id: "ml.randomForest", icon: "🌲", badge: lang === "zh" ? "热门" : (lang === "de" ? "Beliebt" : "Popular") },
        { id: "ml.ridge", icon: "📏", badge: lang === "zh" ? "入门" : (lang === "de" ? "Einsteiger" : "Beginner") },
        { id: "ml.logistic", icon: "🎯", badge: t(lang, "ml", "classification") },
        { id: "ml.kmeans", icon: "🔵", badge: t(lang, "ml", "clustering") },
    ];

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-base)" }}>
            <div style={{ textAlign: "center", maxWidth: 1100, width: "100%" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{t(lang, "nav", "ml")}</h1>
                <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 40, lineHeight: 1.7 }}>
                    {lang === "zh" ? "从左侧选择算法，或点击下方快速开始。平台已内置特征工程与 Train/Test 切分，支持交叉验证调参、实时训练日志，以及专业的模型评估象限图。" :
                        (lang === "de" ? "Wählen Sie links einen Algorithmus oder starten Sie unten direkt. StatLab bietet integriertes Feature Engineering, Train/Test-Split, CV-Tuning und professionelle Evaluation." :
                            "Select an algorithm from the left or quick start below. Integrated feature engineering, train/test split, CV-tuning, and professional model evaluation are all built-in.")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 32 }}>
                    {featured.map(f => {
                        const algo = mlAlgos.find(a => a.id === f.id);
                        if (!algo) return null;
                        return (
                            <div key={f.id} onClick={() => onSelectAlgo(algo)}
                                style={{ padding: 20, borderRadius: 16, background: "var(--bg-surface)", border: "1.5px solid var(--border)", cursor: "pointer", transition: "all 0.2s", textAlign: "center" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(99,102,241,0.15)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{algo.name}</div>
                                <div style={{ fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "2px 8px", borderRadius: 99, display: "inline-block" }}>{f.badge}</div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                    {[
                        { icon: "⚙️", title: lang === "zh" ? "内置特征工程" : (lang === "de" ? "Interne Merkmalsverarbeitung" : "Built-in Feature Engineering"), desc: lang === "zh" ? "缺失值填补 + Z-Score/Min-Max 归一化自动集成到每个算法" : (lang === "de" ? "Imputation + Z-Score/Min-Max Normalisierung ist in jedem Algorithmus integriert." : "Imputation + Z-Score/Min-Max normalization integrated into every algorithm.") },
                        { icon: "✂️", title: lang === "zh" ? "灵活数据切分" : (lang === "de" ? "Flexibler Daten-Split" : "Flexible Data Splitting"), desc: lang === "zh" ? "可调 Train/Test 比例 + K 折交叉验证，防止过拟合" : (lang === "de" ? "Einstellbares Train/Test-Verhältnis + K-Falten Kreuzvalidierung zur Vermeidung von Overfitting." : "Adjustable Train/Test ratio + K-fold cross validation to prevent overfitting.") },
                        { icon: "📊", title: lang === "zh" ? "专业象限分析" : (lang === "de" ? "Professionelle Analyse" : "Professional Analysis"), desc: lang === "zh" ? "回归预测散点图、分类混淆热力图、ROC 曲线实时渲染" : (lang === "de" ? "Regressions-Scatterplots, Konfusionsmatrizen und ROC-Kurven werden in Echtzeit gerendert." : "Regression scatterplots, confusion matrices, and ROC curves rendered in real-time.") }
                    ].map((item, i) => (
                        <div key={i} style={{ padding: 20, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", textAlign: "left" }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Builder Panel ─────────────────────────────────────────────────────────────
function MLBuilder({ algo, activeVersion, assignments, setAssignments, params, setParams, isRunReady, running, onRun, onReset, onViewResult, hasResult, logs, logsEndRef, filteredVars, varSearch, setVarSearch, datasets, onSelectDataset, analysisName, setAnalysisName, analystName, setAnalystName, hasStartedTraining, lang }: any) {

    return (
        <div className="ml-builder-layout" style={{ gridTemplateColumns: hasStartedTraining ? "clamp(200px, 22vw, 240px) minmax(520px, 1fr) clamp(240px, 26vw, 320px)" : "clamp(200px, 22vw, 240px) minmax(520px, 1fr)" }}>
            {/* Variable Panel (reference only) */}
            <div className="ml-var-panel ml-card-panel" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>📂 {t(lang, "ml", "vars") || (lang === "zh" ? "变量一览" : "Variables")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 5, padding: "4px 7px" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span>
                        <input value={varSearch} onChange={e => setVarSearch(e.target.value)}
                            placeholder="过滤..." style={{ border: "none", background: "none", outline: "none", fontSize: 11, color: "var(--text-primary)", width: "100%" }} />
                    </div>
                    {datasets.length > 1 && (
                        <select onChange={e => onSelectDataset(e.target.value)}
                            style={{ width: "100%", marginTop: 8, fontSize: 11, padding: "4px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }}>
                            {datasets.map((d: any) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    )}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
                    {!activeVersion ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>{lang === "zh" ? "请先选择数据集" : "Please select a dataset"}</div>
                    ) : (
                        (() => {
                            const assignedSet = new Set(Object.values(assignments || {}).flat());
                            const unassignedVars = filteredVars.filter((c: any) => !assignedSet.has(c.name));
                            const numVars = unassignedVars.filter((c: any) => c.type === "numeric");
                            const catVars = unassignedVars.filter((c: any) => c.type !== "numeric");

                            return (
                                <>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", marginBottom: 4, padding: "0 4px" }}>{lang === "zh" ? "数值变量" : "Numeric"} ({numVars.length})</div>
                                    {numVars.map((v: any) => (
                                        <MLDraggableVar key={v.name} name={v.name} type={v.type} />
                                    ))}
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", marginBottom: 4, marginTop: 10, padding: "0 4px" }}>{lang === "zh" ? "分类变量" : "Categorical"} ({catVars.length})</div>
                                    {catVars.map((v: any) => (
                                        <MLDraggableVar key={v.name} name={v.name} type={v.type} />
                                    ))}
                                </>
                            );
                        })()
                    )}
                </div>
            </div>


            {/* Center: Config + Logs */}
            <div className="ml-center-pane ml-card-panel" style={{ display: "flex", flexDirection: "column" }}>
                {/* Algo Header Banner */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-raised) 100%)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ background: "var(--accent-dim)", color: "var(--accent)", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🤖</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>{algo.name}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{algo.explanation || algo.description}</div>
                        </div>
                        {hasResult && (
                            <button onClick={onViewResult}
                                style={{ marginLeft: "auto", flexShrink: 0, padding: "7px 16px", borderRadius: 8, background: "var(--success)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                📊 {t(lang, "ml", "viewResults") || (lang === "zh" ? "查看结果" : "View Results")}
                            </button>
                        )}
                    </div>
                </div>

                {/* Slot + Params + Logs split */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
                    {/* Slots + Params */}
                    <div className="ml-scroll" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        {/* Step 1: Variable Slots (click-based) */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ background: "var(--accent)", color: "white", width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>1</span>
                                {lang === "zh" ? "变量分配 —— 点击选择变量" : "Variable Assignment"}
                            </div>
                            {algo.inputSpec.map((spec: any) => (
                                <MLHybridSlot
                                    key={spec.id}
                                    spec={spec}
                                    assigned={assignments[spec.id] || []}
                                    allColumns={activeVersion?.columns || []}
                                    onChange={(vars: string[]) => setAssignments((p: any) => ({ ...p, [spec.id]: vars }))}
                                    lang={lang}
                                />
                            ))}
                        </div>

                        {/* Step 2: Parameters */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ background: "var(--accent)", color: "white", width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>2</span>
                                {lang === "zh" ? "超参数配置 —— 包含特征工程 & 交叉验证" : "Hyperparameters & CV"}
                            </div>
                            <MLParamPanel schema={algo.paramSchema} values={params} onChange={setParams} activeVersion={activeVersion} lang={lang} />
                        </div>

                        {/* Step 3: Range Filters */}
                        <MLDataFilterPanel
                            activeVersion={activeVersion}
                            dataFilters={(params.dataFilters as Record<string, { min?: number, max?: number }>) || {}}
                            onChange={(filters: any) => setParams({ ...params, dataFilters: filters })}
                            lang={lang}
                        />

                        {/* Step 4: Metadata */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ background: "var(--accent)", color: "white", width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>4</span>
                                {lang === "zh" ? "分析元数据 (可选)" : "Metadata (Optional)"}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "12px", background: "var(--bg-surface)", borderRadius: 10, border: "1px dashed var(--border)" }}>
                                <div>
                                    <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{lang === "zh" ? "本次分析名称" : "Analysis Name"}</label>
                                    <input className="input" placeholder={lang === "zh" ? "例如：良率预测模型" : "e.g. Yield Model"} value={analysisName} onChange={e => setAnalysisName(e.target.value)} style={{ padding: "6px 10px", fontSize: 12, width: "100%", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{lang === "zh" ? "分析人" : "Analyst"}</label>
                                    <input className="input" placeholder={lang === "zh" ? "例如：李工" : "e.g. John Doe"} value={analystName} onChange={e => setAnalystName(e.target.value)} style={{ padding: "6px 10px", fontSize: 12, width: "100%", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: 20, flexWrap: "wrap" }}>
                            {(["ml.xgboostReg", "ml.lightgbmReg"].includes(algo.id)) && (
                                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-raised)", fontSize: 12, fontWeight: 700 }}>
                                    <input type="checkbox"
                                        checked={Boolean(params.autoTune ?? (algo.id === "ml.xgboostReg"))}
                                        onChange={e => setParams({ ...params, autoTune: e.target.checked })}
                                    />
                                    智能超参数调优 ({lang === "zh" ? "AutoTune" : "AutoTune"})
                                </label>
                            )}
                            <button onClick={onReset}
                                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                                🔄 {lang === "zh" ? "重置" : (lang === "de" ? "Reset" : "Reset")}
                            </button>
                            <button onClick={onRun} disabled={!isRunReady || running}
                                style={{
                                    flex: 1, padding: "12px 24px", borderRadius: 10, border: "none", cursor: isRunReady && !running ? "pointer" : "not-allowed",
                                    background: isRunReady ? "linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)" : "var(--bg-raised)",
                                    color: isRunReady ? "white" : "var(--text-muted)", fontWeight: 800, fontSize: 15,
                                    boxShadow: isRunReady ? "0 8px 24px rgba(99,102,241,0.35)" : "none", transition: "all 0.2s",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                                }}>
                                {running ? (<><span className="spinner-icon">⏳</span> {t(lang, "ml", "running")}</>) : ("🚀 " + t(lang, "ml", "runAnalysis"))}
                            </button>
                        </div>
                        {!isRunReady && <div style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: -12 }}>⚠️ {lang === "zh" ? "请先完成必填变量的分配" : "Please assign required variables"}</div>}
                    </div>

                    {/* Right: Log Preview - Modified to hide when not training as requested */}
                    {running && (
                        <div className="ml-log-panel ml-card-panel" style={{ background: "#0f172a", display: "flex", flexDirection: "column" }}>
                            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 8, height: 8, background: running ? "#22c55e" : "#64748b", borderRadius: "50%", boxShadow: running ? "0 0 8px #22c55e" : "none" }} />
                                <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>TRAINING LOG</span>
                                {running && <span style={{ marginLeft: "auto", fontSize: 10, color: "#22c55e", fontWeight: 700 }}>● LIVE</span>}
                            </div>
                            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", fontFamily: "monospace", minHeight: 0 }}>
                                {logs.map((l: any, i: number) => (
                                    <div key={i} style={{ padding: "2px 14px", fontSize: 11, lineHeight: 1.6, color: l.level === "error" ? "#f87171" : l.level === "success" ? "#4ade80" : l.level === "warn" ? "#fbbf24" : "#94a3b8" }}>
                                        <span style={{ color: "#475569" }}>{l.ts} </span>{l.msg}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}

// ─── Result View ───────────────────────────────────────────────────────────────
function MLResultView({ result, algo, resTab, setResTab, logs, logsEndRef, onBack, running, params, assignments, runId, lang }: any) {

    const subcategory = algo?.subcategory;
    const regExtras = useMemo(() => (result as any)?.extras?.regression, [result]);
    const modelPkg = useMemo(() => (result as any)?.extras?.modelPackage, [result]);
    const shapData = useMemo(() => regExtras?.shap || modelPkg?.shap || (result as any)?.extras?.shap || null, [regExtras, modelPkg, result]);
    const regressionPayload = regExtras || modelPkg;
    const [predictInputs, setPredictInputs] = useState<Record<string, string>>({});
    const [predictValue, setPredictValue] = useState<number | null>(null);
    const [batchInput, setBatchInput] = useState<string>("");
    const [predicting, setPredicting] = useState(false);
    const [predictOutput, setPredictOutput] = useState<any[] | null>(null);
    const [predictError, setPredictError] = useState<string>("");

    useEffect(() => {
        const features = modelPkg?.featureNames || regExtras?.featureNames;
        if (features && features.length) {
            const init: Record<string, string> = {};
            features.forEach((f: string) => { init[f] = ""; });
            setPredictInputs(init);
            setPredictValue(null);
        }
    }, [regExtras, modelPkg]);

    const featureList = useMemo(() => modelPkg?.featureNames || regExtras?.featureNames || [], [modelPkg, regExtras]);
    const figures = useMemo(() => {
        const fg = (result as any)?.figures;
        return Array.isArray(fg) ? fg : [];
    }, [result]);

    // SHAP importance chart option
    const shapChartOption = useMemo(() => {
        const shap = shapData;
        if (!shap || !Array.isArray(shap) || shap.length === 0) return null;
        return {
            title: { text: '特征重要性 (SHAP)', left: 'center', top: 10, textStyle: { fontSize: 14 } },
            tooltip: {},
            grid: { left: 120, right: 30, top: 40, bottom: 30 },
            xAxis: { type: 'value', name: '重要性' },
            yAxis: { type: 'category', data: shap.map((r: any) => r.feature).reverse() },
            series: [{ type: 'bar', data: shap.map((r: any) => r.importance).reverse(), itemStyle: { color: '#10b981' } }]
        };
    }, [shapData]);

    const handleBatchPredict = async () => {
        setPredictError("");
        setPredictOutput(null);
        if (!runId) { setPredictError("缺少 runId，无法提交预测。请重新训练模型。"); return; }
        let rows: any[] = [];
        try {
            if (!batchInput.trim()) { setPredictError("请输入待预测数据 (JSON 数组)"); return; }
            const parsed = JSON.parse(batchInput);
            rows = Array.isArray(parsed) ? parsed : [parsed];
        } catch (err: any) {
            setPredictError("JSON 解析失败: " + err?.message);
            return;
        }
        if (rows.length === 0) { setPredictError("行数为 0，无法预测"); return; }
        if (rows.length > 2000) { setPredictError("超过 2000 行上限，请分批提交"); return; }

        setPredicting(true);
        try {
            const { data } = await axios.post(`/api/run/${runId}/predict`, { rows });
            setPredictOutput(data?.predictions || []);
            setPredictError("");
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || String(err);
            setPredictError(msg);
        } finally {
            setPredicting(false);
        }
    };

    const fillTemplate = () => {
        if (!featureList.length) return;
        const template = featureList.reduce((acc: any, f: string) => ({ ...acc, [f]: 0 }), {} as Record<string, number>);
        setBatchInput(JSON.stringify([template], null, 2));
    };

    const handleExport = () => {
        if (!result) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            type: "statlab-model", algoId: algo.id, result, params, assignments, logs
        }, null, 2));
        const a = document.createElement("a");
        a.href = dataStr;
        a.download = `model_${algo.id}_${new Date().getTime()}.json`;
        a.click();
    };

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-surface)" }}>
            {/* ── Apple-style Header ── */}
            <div style={{
                padding: "16px 24px",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
            }}>
                <button onClick={onBack}
                    style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: "rgba(0,0,0,0.05)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
                    onMouseOver={e => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
                    onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}>
                    ← {lang === "zh" ? "返回" : "Back"}
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                        {algo?.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {running ? (lang === "zh" ? "正在训练模型…" : "Training...") : result ? (lang === "zh" ? "分析报告" : (lang === "de" ? "Analysebericht" : "Analysis Report")) : ""}
                    </div>
                </div>
                {running && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px rgba(52,211,153,0.6)", animation: "pulse 1.5s ease-in-out infinite" }} />}
                {result && !running && (
                    <>
                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, background: "rgba(34,197,94,0.08)", padding: "5px 12px", borderRadius: 20 }}>✓ {lang === "zh" ? "已完成" : "Completed"}</span>
                        <button onClick={handleExport}
                            style={{ padding: "7px 16px", borderRadius: 20, background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}
                            onMouseOver={e => (e.currentTarget.style.transform = "scale(1.03)")}
                            onMouseOut={e => (e.currentTarget.style.transform = "scale(1)")}>
                            💾 {lang === "zh" ? "导出模型" : "Export Model"}
                        </button>
                    </>
                )}
            </div>

            {/* ── Tab Bar ── */}
            <div style={{
                display: "flex", gap: 4,
                padding: "8px 20px",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                flexShrink: 0,
            }}>
                {[
                    { id: "output", label: lang === "zh" ? "评估指标" : (lang === "de" ? "Metriken" : "Metrics"), icon: "📋" },
                    { id: "charts", label: lang === "zh" ? "可视化" : (lang === "de" ? "Visualisierung" : "Visualization"), icon: "📈" },
                    { id: "logs", label: lang === "zh" ? "训练日志" : (lang === "de" ? "Protokoll" : "Logs"), icon: "🖥️" }
                ].map(t => (
                    <button key={t.id} onClick={() => setResTab(t.id)}
                        style={{
                            padding: "7px 18px", border: "none", cursor: "pointer",
                            fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em",
                            borderRadius: 20,
                            background: resTab === t.id ? "var(--accent)" : "transparent",
                            color: resTab === t.id ? "#fff" : "var(--text-muted)",
                            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: resTab === t.id ? "0 2px 8px rgba(99,102,241,0.25)" : "none",
                        }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Content Area ── */}
            <div style={{ flex: 1, width: "100%", overflowY: "auto", padding: "20px 24px", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
                {/* Narrative Banner */}
                {result?.narrative && (
                    <div style={{
                        background: "rgba(255,255,255,0.8)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(99,102,241,0.15)",
                        borderRadius: 16,
                        padding: "18px 22px",
                        marginBottom: 24,
                        fontSize: 14,
                        color: "var(--text-primary)",
                        lineHeight: 1.75,
                        boxShadow: "0 1px 3px rgba(99,102,241,0.06), 0 8px 24px rgba(99,102,241,0.04)",
                        position: "relative" as const,
                        overflow: "hidden",
                    }}>
                        <div style={{ position: "absolute" as const, top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)", borderRadius: "16px 16px 0 0" }} />
                        <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>💡 {lang === "zh" ? "结论摘要" : (lang === "de" ? "Zusammenfassung" : "Executive Summary")}</span>
                        <div style={{ marginTop: 8, whiteSpace: "pre-line" }}>{result.narrative}</div>
                    </div>
                )}
                {subcategory === "regression" && regressionPayload && (
                    <div style={{ border: "1px solid var(--border)", background: "var(--bg-raised)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>🧮</span>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>{lang === "zh" ? "回归方程与模型评语" : "Equation & Evaluation"}</div>
                            {(regExtras?.evaluation || modelPkg?.evaluation) && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{regExtras?.evaluation || modelPkg?.evaluation}</span>}
                        </div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                            {regExtras?.equation || ""}
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>R²: {regExtras?.metrics?.r2 ?? "-"} · RMSE: {regExtras?.metrics?.rmse ?? "-"}</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{regExtras?.type === "linear" ? "支持手动输入预测" : "支持批量预测（下方）"}</span>
                        </div>
                        {/* SHAP 重要性表格 */}
                        {shapData && Array.isArray(shapData) && shapData.length > 0 && (
                            <div style={{ margin: "16px 0" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>📊 特征重要性 (SHAP)</div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "white", borderRadius: 8, overflow: "hidden" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-overlay)" }}>
                                            <th style={{ padding: "6px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700 }}>特征</th>
                                            <th style={{ padding: "6px 12px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 700 }}>重要性</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shapData.slice().sort((a: any, b: any) => b.importance - a.importance).map((row: any, i: number) => (
                                            <tr key={row.feature} style={{ borderTop: "1px solid var(--border)" }}>
                                                <td style={{ padding: "6px 12px" }}>{row.feature}</td>
                                                <td style={{ padding: "6px 12px" }}>{row.importance}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {/* 非线性模型也显示简易预测入口 */}
                        {regExtras?.featureNames?.length > 0 && (
                            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                                    🔮 {t(lang, "ml", "manualPredict")}<span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>{t(lang, "ml", "manualPredictSub")}</span>
                                </div>
                                <div style={{ 
                                    display: "grid", 
                                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
                                    gap: "12px 16px",
                                    maxHeight: 400,
                                    overflowY: "auto",
                                    padding: "4px 2px",
                                    border: regExtras.featureNames.length > 8 ? "1px solid var(--border)" : "none",
                                    borderRadius: 8,
                                    background: regExtras.featureNames.length > 8 ? "var(--bg-raised)" : "transparent"
                                }}>
                                    {regExtras.featureNames.map((f: string, idx: number) => (
                                        <label key={f} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                                            <span style={{ 
                                                color: "var(--text-secondary)", 
                                                fontWeight: 600, 
                                                whiteSpace: "nowrap", 
                                                overflow: "hidden", 
                                                textOverflow: "ellipsis",
                                                display: "block"
                                            }} title={f}>
                                                {f}
                                            </span>
                                            <input type="number" step="any" value={predictInputs[f] ?? ""} onChange={e => setPredictInputs(p => ({ ...p, [f]: e.target.value }))}
                                                placeholder={regExtras.scaler?.mode && regExtras.scaler.mode !== "none" ? (lang === "zh" ? `${regExtras.scaler.mode} 模式` : `${regExtras.scaler.mode} mode`) : (lang === "zh" ? "输入数值" : "Enter value")}
                                                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "white", fontSize: 13, outline: "none", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)" }} />
                                        </label>
                                    ))}
                                </div>
                                {regExtras?.type === "linear" && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                                        <button onClick={() => {
                                            if (!regExtras) return;
                                            const feats: string[] = regExtras.featureNames || [];
                                            const weights: number[] = regExtras.coefficients || [];
                                            const intercept = regExtras.intercept || 0;
                                            const scaler = regExtras.scaler;
                                            const scaled: number[] = [];
                                            for (let i = 0; i < feats.length; i++) {
                                                const raw = Number(predictInputs[feats[i]]);
                                                if (!isFinite(raw)) { setPredictValue(null); return; }
                                                if (scaler && scaler.mode === "standard") {
                                                    const mean = scaler.means?.[i] ?? 0;
                                                    const sd = scaler.stds?.[i] || 1;
                                                    scaled.push((raw - mean) / (sd || 1));
                                                } else if (scaler && scaler.mode === "minmax") {
                                                    const min = scaler.mins?.[i] ?? 0;
                                                    const max = scaler.maxs?.[i] ?? 1;
                                                    const range = max - min || 1;
                                                    scaled.push((raw - min) / range);
                                                } else {
                                                    scaled.push(raw);
                                                }
                                            }
                                            const y = scaled.reduce((acc, v, i) => acc + v * (weights[i] || 0), intercept);
                                            setPredictValue(Number(y.toFixed(4)));
                                        }}
                                            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--accent)", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                                            {t(lang, "ml", "calculate")}
                                        </button>
                                        {predictValue !== null && <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{t(lang, "ml", "result")}: {predictValue}</span>}
                                    </div>
                                )}
                                <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                                    {t(lang, "ml", "predictionHint")}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {result && runId && modelPkg && (
                    <div style={{ border: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 16 }}>🔮</span>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>{t(lang, "ml", "batchPredict")}</div>
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>runId: {runId}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                            {t(lang, "ml", "batchPredictSub")}{featureList.join(", ") || (lang === "zh" ? "(特征列表未知)" : "(Unknown features)")}
                        </div>
                        <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)}
                            placeholder={"[\\n  { \"feature1\": 1, \"feature2\": 2 }\n]"}
                            style={{ width: "100%", minHeight: 140, borderRadius: 8, border: "1px solid var(--border)", padding: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 12, background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                            <button onClick={fillTemplate} disabled={!featureList.length}
                                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-raised)", cursor: featureList.length ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
                                {lang === "zh" ? "填充单行模板" : "Fill Template"}
                            </button>
                            <button onClick={handleBatchPredict} disabled={predicting}
                                style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: predicting ? "var(--border)" : "var(--accent)", color: "white", cursor: predicting ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}>
                                {predicting ? (lang === "zh" ? "预测中..." : "Predicting...") : (lang === "zh" ? "提交预测" : "Submit")}
                            </button>
                            {predictError && <span style={{ fontSize: 12, color: "var(--danger)" }}>{predictError}</span>}
                        </div>
                        {predictOutput && (
                            <div style={{ marginTop: 10, fontSize: 12, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>{lang === "zh" ? "预测结果（前 20 条）" : "Results (Top 20)"}</div>
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(predictOutput.slice(0, 20), null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}
                {/* Warnings */}
                {result?.warnings && result.warnings.length > 0 && (
                    <div style={{
                        background: "rgba(255,251,235,0.9)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: 14,
                        padding: "14px 18px",
                        marginBottom: 20,
                        boxShadow: "0 1px 3px rgba(245,158,11,0.06)",
                    }}>
                        {result.warnings.map((w: string, i: number) => (
                            <div key={i} style={{ fontSize: 13, color: "#92400e", marginBottom: i < result.warnings.length - 1 ? 6 : 0, display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ flexShrink: 0 }}>⚠️</span>
                                <span>{w}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Output Tab */}
                {resTab === "output" && (
                    <div>
                        {!result && running && <MLTrainingSpinner lang={lang} />}
                        {result && result.tables.map((tbl: any, i: number) => (
                            <MLResultTable key={i} table={tbl} lang={lang} />
                        ))}
                        {result && (
                            <div style={{ marginTop: 12, padding: 12, background: "var(--bg-raised)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                📚 数据引用: {result.citation}
                            </div>
                        )}
                        {/* 内嵌训练日志 */}
                        {logs.length > 1 && (
                            <details style={{ marginTop: 16 }}>
                                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", padding: "8px 0", userSelect: "none" }}>
                                    📜 训练日志（{logs.length} 条）— 点击展开
                                </summary>
                                <div style={{ background: "#0f172a", borderRadius: 10, padding: "10px 4px", maxHeight: 400, overflowY: "auto", fontFamily: "monospace", marginTop: 6 }}>
                                    {logs.map((l: LogEntry, i: number) => (
                                        <div key={i} style={{ padding: "2px 14px", fontSize: 11, lineHeight: 1.5, color: l.level === "error" ? "#f87171" : l.level === "success" ? "#4ade80" : l.level === "warn" ? "#fbbf24" : "#94a3b8" }}>
                                            <span style={{ color: "#475569" }}>[{l.ts}] </span>{l.msg}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}

                {/* Charts Tab */}
                {resTab === "charts" && (
                    <div style={{ paddingBottom: 40 }}>
                        {!result && running && <MLTrainingSpinner lang={lang} />}

                        {/* 采用响应式网格布局，减少拥挤，充分利用大屏空间 */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 720px), 1fr))",
                            gap: "24px",
                            alignItems: "start"
                        }}>
                            {/* SHAP 重要性条形图优先展示 */}
                            {shapChartOption && (
                                <div style={{
                                    gridColumn: figures.length === 0 ? "1 / -1" : "span 1",
                                    // 如果只有一个图，则跨行显示
                                }}>
                                    <MLChart key="shap" title={lang === "zh" ? "特征重要性 (SHAP)" : "Feature Importance (SHAP)"} option={shapChartOption} explanation={lang === "zh" ? "各特征（参数）对目标值的综合影响力排名绝对贡献度。条形越长，代表该特征对目标产生越明显的影响。" : "Absolute contribution of each feature to the target value. Longer bars mean higher impact."} lang={lang} />
                                </div>
                            )}

                            {figures.length === 0 && !shapChartOption && result && (
                                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 80, color: "var(--text-muted)" }}>{lang === "zh" ? "该算法暂无图表输出" : "No charts available for this algorithm"}</div>
                            )}

                            {figures.map((fig: any, i: number) => (
                                <MLChart key={i} title={fig.title} option={fig.option as any} explanation={fig.explanation} lang={lang} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Logs Tab */}
                {resTab === "logs" && (
                    <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, background: running ? "#22c55e" : "#64748b", borderRadius: "50%", boxShadow: running ? "0 0 8px #22c55e" : "none" }} />
                            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>TRAINING LOG  —  {logs.length} 条记录</span>
                            {running && <span style={{ marginLeft: "auto", fontSize: 11, color: "#22c55e", fontWeight: 700 }}>● LIVE</span>}
                        </div>
                        <div style={{ padding: "10px 4px", maxHeight: "calc(100vh - 300px)", overflowY: "auto", fontFamily: "monospace" }}>
                            {logs.map((l: LogEntry, i: number) => (
                                <div key={i} style={{ padding: "3px 16px", fontSize: 12, lineHeight: 1.6, color: l.level === "error" ? "#f87171" : l.level === "success" ? "#4ade80" : l.level === "warn" ? "#fbbf24" : "#94a3b8" }}>
                                    <span style={{ color: "#475569" }}>[{l.ts}] </span>{l.msg}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub Components ────────────────────────────────────────────────────────────

function MLDraggableVar({ name, type }: { name: string; type: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: name });
    const isNum = type === "numeric";
    const style: React.CSSProperties = transform
        ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, zIndex: 999, opacity: 0.8, position: "relative" as const }
        : {};
    return (
        <div ref={setNodeRef} {...listeners} {...attributes}
            style={{
                ...style, margin: "3px 0", padding: "5px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                background: isNum ? "rgba(99,102,241,0.08)" : "rgba(245,158,11,0.08)",
                border: `1px solid ${isNum ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)"}`,
                color: isNum ? "#6366f1" : "#f59e0b",
                display: "flex", alignItems: "center", gap: 6, cursor: "grab",
                userSelect: "none", opacity: isDragging ? 0.4 : 1
            }}>
            <span>{isNum ? "📊" : "🏷️"}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ fontSize: 9, opacity: 0.5 }}>⋮⋮</span>
        </div>
    );
}

function MLHybridSlot({ spec, assigned, allColumns, onChange, lang }: {
    spec: any;
    assigned: string[];
    allColumns: { name: string; type: string }[];
    onChange: (vars: string[]) => void;
    lang: Language;
}) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const { setNodeRef, isOver } = useDroppable({ id: spec.id });
    const compatible = allColumns.filter((c: any) => spec.acceptedTypes.includes(c.type));
    const filtered = filter ? compatible.filter((c: any) => c.name.toLowerCase().includes(filter.toLowerCase())) : compatible;
    const hasMax = typeof spec.max === "number";
    const atMax = hasMax && assigned.length >= spec.max;

    const toggle = (name: string) => {
        if (assigned.includes(name)) {
            onChange(assigned.filter(v => v !== name));
        } else {
            if (atMax) return;
            onChange([...assigned, name]);
        }
    };

    const fillAll = () => {
        const toAdd = compatible.filter((v: any) => !assigned.includes(v.name)).map((v: any) => v.name);
        if (hasMax) {
            onChange([...assigned, ...toAdd.slice(0, spec.max - assigned.length)]);
        } else {
            onChange([...assigned, ...toAdd]);
        }
    };

    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{spec.label}</span>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: spec.acceptedTypes.includes("numeric") ? "var(--accent-dim)" : "rgba(245,158,11,0.1)", color: spec.acceptedTypes.includes("numeric") ? "var(--accent)" : "#f59e0b", fontWeight: 600 }}>
                    {spec.acceptedTypes.map((t: string) => t === "numeric" ? (lang === "zh" ? "定量" : "Numeric") : (lang === "zh" ? "定类" : "Categorical")).join(" / ")}
                </span>
                {spec.min > 0 && assigned.length === 0 && <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 600 }}>{lang === "zh" ? "必填" : "Required"}</span>}
                {hasMax && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{lang === "zh" ? `最多 ${spec.max}` : `Max ${spec.max}`}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    {compatible.length > 0 && !atMax && (
                        <button style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }} onClick={fillAll}>{lang === "zh" ? "全选" : "All"}</button>
                    )}
                    {assigned.length > 0 && (
                        <button style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }} onClick={() => onChange([])}>{lang === "zh" ? "清空" : "Clear"}</button>
                    )}
                </div>
            </div>

            <div ref={setNodeRef} style={{
                minHeight: 44, borderRadius: 8,
                border: isOver ? "2px dashed var(--accent)" : "1px solid var(--border)",
                background: isOver ? "var(--accent-dim)" : "var(--bg-raised)",
                padding: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
                cursor: "pointer", transition: "all 0.15s"
            }} onClick={() => setOpen(!open)}>
                {assigned.length === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 11, padding: "2px 6px" }}>
                        {isOver ? (lang === "zh" ? "松开放入变量" : "Drop here") : (lang === "zh" ? "点击选择 或 拖拽变量至此" : "Click to select or drag here")}
                    </span>
                ) : (
                    assigned.map(v => (
                        <span key={v} style={{
                            padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                            background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
                            display: "flex", alignItems: "center", gap: 5
                        }}>
                            {v}
                            <button onClick={(e) => { e.stopPropagation(); toggle(v); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                    ))
                )}
                <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--text-muted)", padding: "0 4px" }}>{open ? "▲" : "▼"}</span>
            </div>

            {open && (
                <div style={{
                    border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px",
                    background: "var(--bg-surface)", maxHeight: 200, overflowY: "auto"
                }}>
                    <div style={{ padding: "5px 8px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
                        <input
                            placeholder={lang === "zh" ? "搜索变量..." : "Search..."}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 11, outline: "none" }}
                            autoFocus
                        />
                    </div>
                    {filtered.length === 0 ? (
                        <div style={{ padding: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>{lang === "zh" ? "无匹配变量" : "No match"}</div>
                    ) : (
                        filtered.map((c: any) => {
                            const checked = assigned.includes(c.name);
                            const disabled = !checked && atMax;
                            return (
                                <div key={c.name}
                                    onClick={(e) => { e.stopPropagation(); if (!disabled) toggle(c.name); }}
                                    style={{
                                        padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 7,
                                        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                                        background: checked ? "var(--accent-dim)" : "transparent",
                                        borderBottom: "1px solid var(--border)"
                                    }}>
                                    <input type="checkbox" checked={checked} readOnly style={{ accentColor: "var(--accent)" }} />
                                    <span style={{ fontSize: 12 }}>{c.type === "numeric" ? "📊" : "🏷️"}</span>
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{c.type === "numeric" ? (lang === "zh" ? "定量" : "Num") : (lang === "zh" ? "定类" : "Cat")}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function MLParamPanel({ schema, values, onChange, activeVersion, lang }: any) {
    const set = (key: string, val: unknown) => onChange({ ...values, [key]: val });
    const isFeatureEng = (key: string) => ["scale", "impute"].includes(key);
    const isCV = (key: string) => key === "cv";

    const feParams = schema.filter((p: any) => isFeatureEng(p.key));
    const cvParams = schema.filter((p: any) => isCV(p.key));
    const algoParams = schema.filter((p: any) => !isFeatureEng(p.key) && !isCV(p.key));

    const renderParam = (p: any) => (
        <div key={p.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{p.label}</div>
            {p.type === "select" ? (
                <select className="param-input" value={String(values[p.key] ?? p.default ?? "")} onChange={e => set(p.key, e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 12 }}>
                    {(p.options || []).map((o: any) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ) : p.type === "boolean" ? (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={Boolean(values[p.key] ?? p.default)} onChange={e => set(p.key, e.target.checked)} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{values[p.key] ? (lang === "zh" ? "启用" : "Enabled") : (lang === "zh" ? "关闭" : "Disabled")}</span>
                </label>
            ) : p.type === "text" || p.type === "string" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(activeVersion?.columns?.length > 0) && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 2 }}>
                            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginRight: 4 }}>{lang === "zh" ? "插入:" : "Insert:"}</span>
                            <select onChange={e => { if (e.target.value) set(p.key, String(values[p.key] ?? "") + e.target.value); e.target.value = ""; }}
                                style={{ padding: "4px 8px", fontSize: 11, borderRadius: 5, background: "var(--bg-overlay)", border: "1px solid var(--accent)", color: "var(--text-primary)", maxWidth: 140, cursor: "pointer" }}>
                                <option value="">选择变量名称...</option>
                                {activeVersion.columns.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                            {['+', '-', '*', '/', '(', ')', '换行'].map(op => (
                                <button key={op} type="button"
                                    onClick={() => set(p.key, String(values[p.key] ?? "") + (op === "换行" ? "\n" : " " + op + " "))}
                                    style={{ padding: "4px 10px", fontSize: 12, borderRadius: 5, background: "var(--bg-overlay)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-primary)", fontWeight: 700 }}>
                                    {op}
                                </button>
                            ))}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                                <input type="text" id={`custom-name-${p.key}`} placeholder={lang === "zh" ? "新变量名..." : "New var..."}
                                    style={{ padding: "4px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "white", width: 100 }} />
                                <button type="button"
                                    onClick={() => {
                                        const el = document.getElementById(`custom-name-${p.key}`) as HTMLInputElement;
                                        if (el && el.value.trim()) {
                                            const prefix = String(values[p.key] ?? "");
                                            const newline = prefix && !prefix.endsWith("\n") ? "\n" : "";
                                            set(p.key, prefix + newline + el.value.trim() + " = ");
                                            el.value = "";
                                        }
                                    }}
                                    style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                                    {lang === "zh" ? "创建变量名" : "Create"}
                                </button>
                            </div>
                        </div>
                    )}
                    <textarea rows={3} value={String(values[p.key] ?? p.default ?? "")} onChange={e => set(p.key, e.target.value)}
                        placeholder={p.placeholder || (lang === "zh" ? "输入公式，以英文字符书写，如 A / B" : "Enter formula, e.g. A / B")}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 13, resize: "vertical", fontFamily: "monospace" }} />
                </div>
            ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="number" min={p.min} max={p.max} step={p.step ?? 1}
                        value={String(values[p.key] ?? p.default ?? "")}
                        onChange={e => set(p.key, Number(e.target.value))}
                        style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 12 }} />
                    {p.min !== undefined && p.max !== undefined && (
                        <input type="range" min={p.min} max={p.max} step={p.step ?? 1}
                            value={Number(values[p.key] ?? p.default ?? p.min)}
                            onChange={e => set(p.key, Number(e.target.value))}
                            style={{ flex: 1, accentColor: "var(--accent)" }} />
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40 }}>{String(values[p.key] ?? p.default ?? "")}</span>
                </div>
            )}
        </div>
    );

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {/* Feature Engineering group */}
            {feParams.length > 0 && (
                <div style={{ gridColumn: "1 / -1", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>⚙️ {lang === "zh" ? "特征工程（已内置）" : "Feature Engineering (Built-in)"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                        {feParams.map(renderParam)}
                    </div>
                </div>
            )}
            {/* CV group */}
            {cvParams.length > 0 && (
                <div style={{ gridColumn: "1 / -1", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 10 }}>🔁 {lang === "zh" ? "交叉验证配置" : "Cross Validation"}</div>
                    {cvParams.map(renderParam)}
                </div>
            )}
            {/* Algo-specific params */}
            {algoParams.map(renderParam)}
        </div>
    );
}

function MLDataFilterPanel({ activeVersion, dataFilters, onChange, lang }: any) {
    const allVars = activeVersion?.columns || [];
    const activeFilters = Object.keys(dataFilters);
    const availableVars = allVars.filter((v: any) => !activeFilters.includes(v.name));

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ background: "var(--accent)", color: "white", width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>3</span>
                {lang === "zh" ? "数据筛选 (可选) —— 筛选分析所用样本的数据范围" : "Data Filtering (Optional)"}
            </div>
            <div style={{ padding: "12px 16px", background: "rgba(59,130,246,0.04)", border: "1px dashed rgba(59,130,246,0.3)", borderRadius: 10 }}>
                {activeFilters.length > 0 && activeFilters.map((fName: string) => {
                    const filter = dataFilters[fName];
                    const varInfo = allVars.find((v: any) => v.name === fName);
                    const isNumeric = varInfo?.type === "numeric";
                    return (
                        <div key={fName} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, background: "#fff", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }} title={fName}>{fName} {isNumeric ? "" : "(类别)"}</div>
                            {isNumeric ? (
                                <>
                                    <input type="number" placeholder="下限 (Min)" value={filter.min ?? ""} onChange={e => {
                                        const val = e.target.value ? Number(e.target.value) : undefined;
                                        onChange({ ...dataFilters, [fName]: { ...filter, min: val } });
                                    }} style={{ width: 100, padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>至</span>
                                    <input type="number" placeholder="上限 (Max)" value={filter.max ?? ""} onChange={e => {
                                        const val = e.target.value ? Number(e.target.value) : undefined;
                                        onChange({ ...dataFilters, [fName]: { ...filter, max: val } });
                                    }} style={{ width: 100, padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                                </>
                            ) : (
                                <>
                                    <select value={filter.eq !== undefined ? "eq" : filter.contains !== undefined ? "contains" : "eq"} onChange={e => {
                                        const op = e.target.value;
                                        const val = filter.eq ?? filter.contains ?? "";
                                        if (op === "eq") {
                                            onChange({ ...dataFilters, [fName]: { eq: val, contains: undefined } });
                                        } else {
                                            onChange({ ...dataFilters, [fName]: { contains: val, eq: undefined } });
                                        }
                                    }} style={{ width: 70, padding: "5px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", outline: "none" }}>
                                        <option value="eq">{lang === "zh" ? "等于" : "Equals"}</option>
                                        <option value="contains">{lang === "zh" ? "包含" : "Contains"}</option>
                                    </select>
                                    <input type="text" placeholder={lang === "zh" ? "匹配文本..." : "Match text..."} value={filter.eq ?? filter.contains ?? ""} onChange={e => {
                                        const val = e.target.value;
                                        if (filter.contains !== undefined) {
                                            onChange({ ...dataFilters, [fName]: { ...filter, contains: val } });
                                        } else {
                                            onChange({ ...dataFilters, [fName]: { ...filter, eq: val } });
                                        }
                                    }} style={{ width: 120, padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)" }} />
                                </>
                            )}
                            <button title="移除" onClick={() => {
                                const copy = { ...dataFilters };
                                delete copy[fName];
                                onChange(copy);
                            }} style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 11, padding: "4px", marginLeft: "auto", fontWeight: 600 }}>✖ 移除</button>
                        </div>
                    );
                })}
                {availableVars.length > 0 && (
                    <div style={{ marginTop: activeFilters.length ? 8 : 0 }}>
                        <select onChange={e => {
                            if (e.target.value) {
                                onChange({ ...dataFilters, [e.target.value]: {} });
                                e.target.value = "";
                            }
                        }} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.4)", background: "#fff", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none", width: "100%", maxWidth: 300 }}>
                            <option value="">➕ {lang === "zh" ? "添加特征进行过滤..." : "Add filter..."}</option>
                            {availableVars.map((v: any) => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}

function MLResultTable({ table, lang }: { table: any; lang: Language }) {
    const [sortCol, setSortCol] = useState<number | null>(null);
    const [sortAsc, setSortAsc] = useState(false);

    const handleSort = (idx: number) => {
        if (sortCol === idx) { if (!sortAsc) setSortCol(null); else setSortAsc(false); }
        else { setSortCol(idx); setSortAsc(false); }
    };

    const displayRows = useMemo(() => {
        if (sortCol === null) return table.rows;
        return [...table.rows].sort((a: any[], b: any[]) => {
            const va = a[sortCol], vb = b[sortCol];
            if (va === vb) return 0;
            const na = parseFloat(String(va)), nb = parseFloat(String(vb));
            if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
            return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
    }, [table.rows, sortCol, sortAsc]);

    const colorCell = (val: any, col: string) => {
        const s = String(val); const lo = col.toLowerCase();
        if (lo.includes("r²") || lo.includes("r2")) {
            const n = parseFloat(s);
            if (!isNaN(n)) return n >= 0.8 ? "#16a34a" : n >= 0.5 ? "#d97706" : "#dc2626";
        }
        if (lo.includes("acc") || lo.includes("f1") || lo.includes("auc") || lo.includes("recall") || lo.includes("preci")) {
            const n = parseFloat(s);
            if (!isNaN(n)) return n >= 0.8 ? "#16a34a" : n >= 0.6 ? "#d97706" : "#dc2626";
        }
        return undefined;
    };

    return (
        <div style={{
            marginBottom: 22,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.06)",
            transition: "box-shadow 0.3s ease",
        }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)")}
            onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)")}
        >
            <div style={{
                padding: "14px 20px",
                background: "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.9) 100%)",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
            }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{table.title}</div>
                {table.explanation && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontWeight: 400, lineHeight: 1.6 }}>
                        {table.explanation}
                    </div>
                )}
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr>
                            {table.columns.map((c: string, idx: number) => (
                                <th key={c} onClick={() => handleSort(idx)}
                                    style={{
                                        padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 11,
                                        color: "var(--text-muted)", cursor: "pointer", userSelect: "none",
                                        whiteSpace: "nowrap", textTransform: "uppercase" as const, letterSpacing: "0.04em",
                                        background: "rgba(248,250,252,0.6)",
                                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                                    }}>
                                    {c}
                                    <span style={{ opacity: sortCol === idx ? 0.8 : 0.25, marginLeft: 4, fontSize: 10 }}>
                                        {sortCol === idx ? (sortAsc ? "↑" : "↓") : "⇅"}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row: any[], i: number) => (
                            <tr key={i} style={{
                                borderTop: "1px solid rgba(0,0,0,0.04)",
                                transition: "background 0.15s",
                            }}
                                onMouseOver={e => (e.currentTarget.style.background = "rgba(99,102,241,0.03)")}
                                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                            >
                                {row.map((val: any, j: number) => {
                                    const color = colorCell(val, table.columns[j] || "");
                                    return (
                                        <td key={j} style={{
                                            padding: "10px 16px",
                                            color: color || "var(--text-primary)",
                                            fontWeight: color ? 600 : 400,
                                            fontSize: 13,
                                        }}>
                                            {val === null || val === undefined ? "—" : String(val)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MLChart({ title, option, explanation, lang }: { title: string; option: Record<string, unknown>; explanation?: string; lang: Language }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<HTMLDivElement | null>(null);
    const instanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);
    const [height, setHeight] = useState(380);
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
        if (!chartRef.current) return;
        if (!instanceRef.current) {
            instanceRef.current = echarts.init(chartRef.current, undefined);
        }
        instanceRef.current.setOption({ backgroundColor: "transparent", ...option }, true);
        const handle = () => instanceRef.current?.resize();
        window.addEventListener("resize", handle);
        return () => window.removeEventListener("resize", handle);
    }, [option]);

    useEffect(() => { instanceRef.current?.resize(); }, [height]);

    return (
        <div style={{
            marginBottom: 22,
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.06)",
            transition: "box-shadow 0.3s ease",
        }}
            onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)")}
            onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)")}
        >
            <div style={{
                padding: "14px 20px",
                background: "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.9) 100%)",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
            }}>
                <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{title}</span>
                    {explanation && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.6, fontWeight: 400 }}>
                            {explanation}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>{lang === "zh" ? "滚轮缩放" : "Zoom"}</span>
                    <button onClick={() => setFullscreen(true)}
                        style={{
                            padding: "5px 14px", borderRadius: 20, border: "none",
                            background: "rgba(0,0,0,0.05)", cursor: "pointer", fontSize: 11,
                            fontWeight: 500, color: "var(--text-secondary)", transition: "all 0.2s",
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
                        onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}>
                        ⛶ {lang === "zh" ? "放大" : "Zoom"}
                    </button>
                </div>
            </div>
            <div ref={chartRef} style={{ width: "100%", height: `${height}px`, background: "rgba(255,255,255,0.5)" }} />
            <div onMouseDown={e => {
                const startY = e.clientY, startH = height;
                const onMove = (ev: MouseEvent) => setHeight(Math.max(200, startH + ev.clientY - startY));
                const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
            }} style={{
                height: 6, cursor: "ns-resize",
                background: "linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.06))",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
            </div>
            {fullscreen && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    backdropFilter: "blur(12px)",
                    zIndex: 9999,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "40px",
                }} onClick={() => setFullscreen(false)}>
                    <div style={{
                        width: "100%", maxWidth: "1280px", height: "85vh",
                        background: "rgba(255,255,255,0.94)",
                        backdropFilter: "blur(30px)",
                        borderRadius: 24,
                        overflow: "hidden",
                        display: "flex", flexDirection: "column",
                        boxShadow: "0 30px 90px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
                        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: "18px 24px",
                            borderBottom: "1px solid rgba(0,0,0,0.06)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "rgba(255,255,255,0.5)"
                        }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{title}</div>
                                {explanation && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{explanation}</div>}
                            </div>
                            <button onClick={() => setFullscreen(false)}
                                style={{
                                    width: 34, height: 34, borderRadius: "50%", border: "none",
                                    background: "rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 18,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "var(--text-secondary)", transition: "all 0.2s"
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
                                onMouseOut={e => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}>
                                ✕
                            </button>
                        </div>
                        <div style={{ flex: 1, position: "relative" }}>
                            <FullscreenChart option={option} />
                            <div style={{ position: "absolute", bottom: 16, left: 16, fontSize: 11, color: "var(--text-muted)", background: "rgba(255,255,255,0.7)", padding: "4px 10px", borderRadius: 20 }}>
                                💡 {lang === "zh" ? "您可以使用鼠标滚轮在图中进行局部放大和缩小" : "Use mouse wheel to zoom in/out"}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FullscreenChart({ option }: { option: Record<string, unknown> }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        const chart = echarts.init(ref.current);
        chart.setOption({ backgroundColor: "transparent", ...option }, true);
        const h = () => chart.resize();
        window.addEventListener("resize", h);
        return () => { chart.dispose(); window.removeEventListener("resize", h); };
    }, [option]);
    return <div ref={ref} style={{ width: "100%", height: "calc(100% - 53px)" }} />;
}

function MLTrainingSpinner({ lang }: { lang: Language }) {
    return (
        <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 20px", borderRadius: "50%", border: "3px solid rgba(99,102,241,0.15)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>{lang === "zh" ? "正在分析数据…" : "Analyzing data..."}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{lang === "zh" ? "请查看训练日志了解进度" : "Check logs for progress"}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
    );
}
