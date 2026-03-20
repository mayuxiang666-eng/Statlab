import { useState, useEffect } from "react";
import axios from "axios";
import { DbConnectionInfo, TreeNode, DbTablePreview, ColumnMeta } from "@statlab/shared";
import { Database, Server, Settings, CheckCircle } from "lucide-react";

interface Props {
    onDatasetCreated: (datasetId: string) => void;
    onBack: () => void;
    addLog: (level: "info" | "success" | "warn" | "error", msg: string) => void;
}

type Step = "connect" | "select" | "range";

export default function DbConnect({ onDatasetCreated, onBack, addLog }: Props) {
    const [step, setStep] = useState<Step>("connect");
    const [loading, setLoading] = useState(false);

    // Step 1: Connection
    const [presets, setPresets] = useState<DbConnectionInfo[]>([]);
    const [savedConns, setSavedConns] = useState<DbConnectionInfo[]>([]);
    const [selectedConnId, setSelectedConnId] = useState<string>("");
    const [isCustom, setIsCustom] = useState(false);
    const [customForm, setCustomForm] = useState({
        name: "", type: "mssql" as any, host: "", port: 1433, database: "", user: "", password: ""
    });

    const [renameValue, setRenameValue] = useState("");
    const [restored, setRestored] = useState(false);

    // Step 2: Select Table
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [tableSearch, setTableSearch] = useState("");
    const [selectedTable, setSelectedTable] = useState<string>("");
    const [preview, setPreview] = useState<DbTablePreview | null>(null);
    const [tagged, setTagged] = useState<Record<string, string[]>>({});
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [timeColumn, setTimeColumn] = useState<string>("");

    // Step 3: Range Control
    const [range, setRange] = useState({
        timeRangePreset: "7d",
        sampling: "all",
        timeRange: { start: "", end: "" } as { start: string; end: string }
    });
    const [granularity, setGranularity] = useState("hour");

    const [fieldFilter, setFieldFilter] = useState("");

    // Load last session snapshot from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem("db-connect-state");
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.step) setStep(saved.step);
            if (saved.selectedConnId) setSelectedConnId(saved.selectedConnId);
            if (typeof saved.isCustom === "boolean") setIsCustom(saved.isCustom);
            if (saved.customForm) setCustomForm((p) => ({ ...p, ...saved.customForm }));
            if (saved.selectedTable) setSelectedTable(saved.selectedTable);
            if (Array.isArray(saved.selectedColumns)) setSelectedColumns(saved.selectedColumns);
            if (saved.timeColumn) setTimeColumn(saved.timeColumn);
            if (saved.range) setRange((p) => ({ ...p, ...saved.range }));
            if (saved.granularity) setGranularity(saved.granularity);
            if (saved.fieldFilter) setFieldFilter(saved.fieldFilter);
        } catch { /* ignore parse errors */ }
    }, []);

    const [connStatus, setConnStatus] = useState<"idle" | "success" | "error" | "testing">("idle");
    const [statusMsg, setStatusMsg] = useState("未连接");

    const [validationStatus, setValidationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [validationMessage, setValidationMessage] = useState("");
    const [validationErrorCode, setValidationErrorCode] = useState("");

    const [fieldsLoading, setFieldsLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    const customReady = !!(customForm.host && customForm.database && customForm.user);
    const canProceed = isCustom ? customReady : !!selectedConnId;

    const dataSources = [
        { id: "mssql", name: "SQL Server", desc: "工厂生产库 / MES", icon: <Server size={18} /> },
        { id: "postgres", name: "PostgreSQL", desc: "制造数据湖 / 历史库", icon: <Database size={18} /> },
        { id: "mysql", name: "MySQL / MariaDB", desc: "设备侧数据库 / 轻量服务", icon: <Settings size={18} /> }
    ];

    const isCustomRange = range.timeRangePreset === "custom";
    const isRangeValid = !isCustomRange || (!!range.timeRange?.start && !!range.timeRange?.end);

    const computeTimeWindow = () => {
        const now = new Date();
        if (isCustomRange && range.timeRange?.start && range.timeRange?.end) {
            return {
                start: new Date(range.timeRange.start).toISOString(),
                end: new Date(range.timeRange.end).toISOString()
            };
        }
        const presetToMs: Record<string, number> = {
            "1h": 3600_000,
            "1d": 24 * 3600_000,
            "7d": 7 * 24 * 3600_000,
            "30d": 30 * 24 * 3600_000
        };
        const span = presetToMs[range.timeRangePreset] || 0;
        return {
            start: new Date(now.getTime() - span).toISOString(),
            end: now.toISOString()
        };
    };

    const loadConnections = async () => {
        const [pre, saved] = await Promise.all([
            axios.get("/api/connections/presets"),
            axios.get("/api/connections/saved").catch(() => ({ data: [] }))
        ]);
        setPresets(pre.data);
        setSavedConns(saved.data || []);
    };

    useEffect(() => {
        loadConnections();
    }, []);

    // After connections are loaded, try to restore tree/preview so data is not lost on refresh
    useEffect(() => {
        const shouldRestore = selectedConnId && !restored;
        if (!shouldRestore) return;
        (async () => {
            setLoading(true);
            await loadTreeSilently(selectedConnId);
            if (selectedTable) {
                await handlePreview(selectedTable);
            }
            setRestored(true);
            setLoading(false);
        })();
    }, [selectedConnId, selectedTable, restored]);

    // Persist key states so refresh retains selection
    useEffect(() => {
        try {
            localStorage.setItem("db-connect-state", JSON.stringify({
                step,
                selectedConnId,
                isCustom,
                customForm,
                selectedTable,
                selectedColumns,
                timeColumn,
                range,
                granularity,
                fieldFilter
            }));
        } catch { /* ignore quota errors */ }
    }, [step, selectedConnId, isCustom, customForm, selectedTable, selectedColumns, timeColumn, range, granularity, fieldFilter]);

    const handleTest = async () => {
        setLoading(true);
        setConnStatus("testing");
        setStatusMsg("测试连接中...");
        try {
            if (isCustom) {
                await axios.post("/api/connections/custom/test", customForm);
            } else if (selectedConnId) {
                await axios.post(`/api/connections/${selectedConnId}/test`);
            }
            addLog("success", "连接测试成功！已联通生产库。");
            setConnStatus("success");
            setStatusMsg("已连接");
            alert(`已成功连接「${isCustom ? customForm.name : presets.find(p => p.id === selectedConnId)?.name}」，可直接跳转至下一步取数。`);
        } catch (e: any) {
            addLog("error", `连接失败: ${e.response?.data?.error || "请检查网络"}`);
            setConnStatus("error");
            setStatusMsg(e.response?.data?.error || "连接失败");
        } finally {
            setLoading(false);
        }
    };

    const goToSelect = async () => {
        let connId = selectedConnId;
        if (isCustom) {
            setLoading(true);
            try {
                const res = await axios.post("/api/connections/custom/save", customForm);
                connId = res.data.id;
                setSelectedConnId(connId);
                await loadConnections();
            } catch (e) {
                addLog("error", "保存连接失败"); return;
            } finally { setLoading(false); }
        }

        if (!connId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/connections/${connId}/tree`);
            setTree(res.data);
            setConnStatus("success");
            setStatusMsg("已连接");
            setStep("select");
        } catch (e) {
            addLog("error", "加载表列表失败");
            setConnStatus("error");
            setStatusMsg("加载表失败");
        } finally { setLoading(false); }
    };

    const loadTreeSilently = async (connId: string) => {
        try {
            const res = await axios.get(`/api/connections/${connId}/tree`);
            setTree(res.data);
            setConnStatus("success");
            setStatusMsg("已连接");
        } catch (e) {
            setConnStatus("error");
            setStatusMsg("加载表失败");
        }
    };

    const handleRename = async () => {
        if (!selectedConnId) return;
        setLoading(true);
        try {
            await axios.patch(`/api/connections/${selectedConnId}`, { name: renameValue });
            await loadConnections();
            addLog("success", "实例名称已更新");
        } catch (e: any) {
            addLog("error", e.response?.data?.error || "更新失败");
        } finally { setLoading(false); }
    };

    const handleDeleteConn = async () => {
        if (!selectedConnId) return;
        if (!window.confirm("确认删除该数据库实例？")) return;
        setLoading(true);
        try {
            await axios.delete(`/api/connections/${selectedConnId}`);
            setSelectedConnId("");
            setPreview(null);
            setSelectedColumns([]);
            setSelectedTable("");
            await loadConnections();
            addLog("success", "实例已删除");
        } catch (e: any) {
            addLog("error", e.response?.data?.error || "删除失败");
        } finally { setLoading(false); }
    };

    const handlePreview = async (table: string) => {
        if (!table || !selectedConnId) return;
        setSelectedTable(table);
        setLoading(true);
        setFieldsLoading(true);
        setPreviewLoading(true);
        try {
            // First fetch without time filter to get authoritative columns
            const baseRes = await axios.post(`/api/connections/${selectedConnId}/preview`, { table });
            const baseColumns: ColumnMeta[] = baseRes.data.columns || [];
            setPreview({ columns: baseColumns, rows: baseRes.data.rows });
            setTagged(baseRes.data.tagged || {});
            setSelectedColumns(baseColumns.map((c: ColumnMeta) => c.name));

            const firstTime = baseColumns.find((c: ColumnMeta) => c.name.toLowerCase() === "timestamp")?.name
                || baseColumns.find((c: ColumnMeta) => c.type === "datetime")?.name
                || baseColumns[0]?.name
                || "";
            const nextTimeCol = firstTime || timeColumn;
            setTimeColumn(nextTimeCol);

            // Apply time filter only if column exists in current table and range有效
            const window = computeTimeWindow();
            const canFilter = nextTimeCol && baseColumns.some(c => c.name === nextTimeCol) && isRangeValid;
            if (canFilter && window) {
                const filteredRes = await axios.post(`/api/connections/${selectedConnId}/preview`, {
                    table,
                    timeFilter: { column: nextTimeCol, start: window.start, end: window.end }
                });
                setPreview({ columns: filteredRes.data.columns, rows: filteredRes.data.rows });
                setTagged(filteredRes.data.tagged || {});
            }
        } catch (e: any) {
            const errMsg = e.response?.data?.error || e.message || "预览失败";
            addLog("error", `预览失败: ${errMsg}`);
            alert(`数据预览失败：${errMsg}`);
        } finally {
            setLoading(false);
            setFieldsLoading(false);
            setPreviewLoading(false);
        }
    };

    const handleValidate = async () => {
        if (isCustomRange && !isRangeValid) {
            setValidationStatus("error");
            setValidationMessage("请填写完整的自定义时间范围");
            setValidationErrorCode("RANGE_MISSING");
            return;
        }
        if (!timeColumn) {
            setValidationStatus("error");
            setValidationMessage("请选择时间字段");
            setValidationErrorCode("TIME_FIELD_MISSING");
            return;
        }
        if (!selectedColumns.length) {
            setValidationStatus("error");
            setValidationMessage("请至少勾选 1 个字段参与分析");
            setValidationErrorCode("NO_FIELDS");
            return;
        }
        setValidationStatus("loading");
        setValidationMessage("正在校验字段与时间范围...");
        setValidationErrorCode("");
        try {
            await axios.post(`/api/connections/${selectedConnId}/preview`, { table: selectedTable });
            setValidationStatus("success");
            setValidationMessage("校验通过，配置可用");
            addLog("success", "范围与字段校验通过");
        } catch (e: any) {
            const errMsg = e.response?.data?.error || "校验失败";
            setValidationStatus("error");
            setValidationMessage(errMsg);
            setValidationErrorCode(e.response?.data?.code || "VALIDATION_ERROR");
            addLog("error", `校验失败: ${errMsg}`);
        }
    };

    useEffect(() => {
        setValidationStatus("idle");
        setValidationMessage("");
        setValidationErrorCode("");
    }, [timeColumn, range.timeRangePreset, range.timeRange?.start, range.timeRange?.end, selectedColumns.length]);

    useEffect(() => {
        if (step === "range" && selectedTable && timeColumn) {
            handlePreview(selectedTable);
        }
    }, [step, selectedTable, timeColumn, range.timeRangePreset, range.timeRange?.start, range.timeRange?.end]);

    const buildDataset = async () => {
        setLoading(true);
        const timeRange = range.timeRange?.start && range.timeRange?.end
            ? {
                start: new Date(range.timeRange.start).toISOString(),
                end: new Date(range.timeRange.end).toISOString()
            }
            : undefined;
        try {
            const res = await axios.post("/api/connections/dataset/build", {
                connectionId: selectedConnId,
                table: selectedTable,
                rangeFilters: { ...range, timeRange },
                sampling: range.sampling,
                columns: selectedColumns,
                timeColumn,
                granularity
            });
            addLog("success", `取数完成，共拉取 ${res.data.rowCount || "指定"} 条制造数据`);
            onDatasetCreated(res.data.datasetId);
        } catch (e: any) {
            addLog("error", e.response?.data?.error || "取数失败");
        } finally { setLoading(false); }
    };

    const previewColumns = selectedColumns.length ? selectedColumns : (preview?.columns || []).map(c => c.name);

    const filterColumns = (cols: ColumnMeta[]) => {
        if (!fieldFilter.trim()) return cols;
        try {
            const reg = new RegExp(fieldFilter.trim(), "i");
            return cols.filter(c => reg.test(c.name) || reg.test(c.type || ""));
        } catch {
            const text = fieldFilter.trim().toLowerCase();
            return cols.filter(c => c.name.toLowerCase().includes(text) || (c.type || "").toLowerCase().includes(text));
        }
    };
    const showFieldsSkeleton = fieldsLoading || !preview;
    const canConfirm = isRangeValid && selectedColumns.length > 0 && !!timeColumn;

    if (step === "range") {
        return (
            <div className="range-page">
                <div className="range-container">
                    <header className="range-header">
                        <div className="range-breadcrumb">连接生产数据库 / Step 3</div>
                        <h1>范围与字段选择</h1>
                        <p className="range-subtitle">选择分析时间范围，并指定参与分析的数据字段</p>
                    </header>
                </div>

                <div className="range-container">
                    <div className="range-main">
                        <div className="range-left">
                            <div className="range-card" style={{ gap: 16 }}>
                                <div className="card-title-row">
                                    <div className="card-title-text">分析时间范围</div>
                                </div>
                                <div className="quick-group">
                                    {[{ id: "1h", label: "最近1小时" }, { id: "1d", label: "最近24小时" }, { id: "7d", label: "最近7天" }, { id: "custom", label: "自定义" }].map(opt => (
                                        <button
                                            key={opt.id}
                                            className={`chip-btn ${range.timeRangePreset === opt.id ? "chip-btn-active" : ""}`}
                                            onClick={() => setRange({ ...range, timeRangePreset: opt.id, timeRange: opt.id === "custom" ? range.timeRange : { start: "", end: "" } })}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {isCustomRange && (
                                    <div className="custom-range" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        <input
                                            type="datetime-local"
                                            className="param-input"
                                            value={range.timeRange?.start || ""}
                                            onChange={(e) => setRange({ ...range, timeRangePreset: "custom", timeRange: { start: e.target.value, end: range.timeRange?.end || "" } })}
                                        />
                                        <input
                                            type="datetime-local"
                                            className="param-input"
                                            value={range.timeRange?.end || ""}
                                            onChange={(e) => setRange({ ...range, timeRangePreset: "custom", timeRange: { start: range.timeRange?.start || "", end: e.target.value } })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="range-card" style={{ gap: 12 }}>
                                <div className="card-title-row">
                                    <div className="card-title-text">时间字段</div>
                                </div>
                                <select className="param-input" value={timeColumn} onChange={e => setTimeColumn(e.target.value)} title={timeColumn}>
                                    <option value="">请选择时间字段</option>
                                    {(preview?.columns || []).filter(c => c.type === "datetime").map(c => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="range-card" style={{ gap: 12 }}>
                                <div className="card-title-row">
                                    <div className="card-title-text">分析粒度/范围</div>
                                    <div className="card-subtext">用于聚合与趋势分析</div>
                                </div>
                                <select className="param-input" value={granularity} onChange={e => setGranularity(e.target.value)}>
                                    <option value="minute">按分钟</option>
                                    <option value="hour">按小时</option>
                                    <option value="day">按天</option>
                                </select>
                            </div>
                        </div>

                        <div className="range-right">
                            {validationStatus !== "idle" && (
                                <div className={`range-banner ${validationStatus === "error" ? "error" : "success"}`}>
                                    <div>{validationMessage}</div>
                                    {validationStatus === "error" && validationErrorCode && (
                                        <button className="link-btn" onClick={() => navigator.clipboard?.writeText(validationErrorCode)}>复制错误码</button>
                                    )}
                                </div>
                            )}

                            <div className="range-card" style={{ gap: 16 }}>
                                <div className="card-head">
                                    <div>
                                        <div className="card-title-text">选择分析字段</div>
                                        <div className="card-subtext">已选 {selectedColumns.length} / {preview?.columns.length || 0}</div>
                                    </div>
                                    <div className="card-actions">
                                        <button className="link-btn" onClick={() => setSelectedColumns(preview?.columns.map(c => c.name) || [])}>全选</button>
                                        <button className="link-btn" onClick={() => setSelectedColumns([])}>清空</button>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        className="param-input"
                                        placeholder="正则或关键词过滤字段，例如: Temp|Pressure"
                                        value={fieldFilter}
                                        onChange={(e) => setFieldFilter(e.target.value)}
                                        style={{ width: "100%", height: 36 }}
                                    />
                                </div>
                                {showFieldsSkeleton ? (
                                    <div className="fields-skeleton" />
                                ) : (preview?.columns || []).length === 0 ? (
                                    <div className="empty-state soft">暂无可选字段</div>
                                ) : (
                                    <div className="field-grid">
                                        {filterColumns(preview?.columns || []).map(c => (
                                            <label key={c.name} className="field-item" title={c.name}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedColumns.includes(c.name)}
                                                    onChange={() => {
                                                        setSelectedColumns(prev => prev.includes(c.name)
                                                            ? prev.filter(x => x !== c.name)
                                                            : [...prev, c.name]);
                                                    }}
                                                />
                                                <span className="field-name">{c.name}</span>
                                                <span className="field-type">{c.type}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="range-card" style={{ gap: 12 }}>
                                <div className="card-head">
                                    <div className="card-title-text">数据预览（最近5行）</div>
                                    <button className="link-btn" onClick={() => handlePreview(selectedTable)} disabled={!selectedTable || previewLoading}>刷新</button>
                                </div>
                                <div className="preview-table" style={{ minHeight: 220 }}>
                                    {previewLoading ? (
                                        <div className="empty-state soft">加载预览...</div>
                                    ) : !preview || preview.rows.length === 0 ? (
                                        <div className="empty-state soft">暂无数据</div>
                                    ) : (
                                        <div className="table-scroll">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        {previewColumns.map(col => <th key={col}>{col}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.rows.slice(0, 5).map((row, i) => (
                                                        <tr key={i}>
                                                            {previewColumns.map(col => <td key={col}>{String(row[col] ?? "")}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="range-footer">
                    <div className="range-container range-footer-inner">
                        <button className="btn btn-ghost" onClick={() => setStep("select")}>返回上一步</button>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button className="btn btn-secondary" onClick={handleValidate} disabled={validationStatus === "loading"}>测试/校验</button>
                            <button
                                className="btn btn-primary"
                                style={{ minHeight: 40, minWidth: 220 }}
                                disabled={!canConfirm || loading}
                                onClick={buildDataset}
                            >
                                {loading ? "处理中..." : "确认范围，进入分析工作台（下一步）"}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }

    return (
        <div className="db-connect-page" style={{ padding: 24, paddingBottom: 60, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 1280, display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
                {/* Left: Steps */}
                <aside className="card" style={{ padding: 20, height: "fit-content" }}>
                    <h4 style={{ margin: "0 0 12px", color: "var(--text-muted)" }}>步骤</h4>
                    {[{ id: "connect", label: "连接数据库", desc: "选择来源并校验" }, { id: "select", label: "选择表与预览", desc: "确认字段与样本" }, { id: "range", label: "范围与拉数", desc: "控制时间与行数" }].map((s, idx) => {
                        const isActive = step === s.id;
                        const isDone = step !== s.id && ["select", "range"].includes(step) && idx < ["connect", "select", "range"].indexOf(step as any);
                        return (
                            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, padding: "10px 0", alignItems: "center" }}>
                                <div style={{ width: 20, height: 20, borderRadius: 10, display: "grid", placeItems: "center", border: `1px solid ${isActive ? "var(--accent)" : "var(--border-subtle)"}`, background: isActive ? "rgba(47,108,255,0.1)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                                    {isDone ? <CheckCircle size={14} color="var(--success)" /> : idx + 1}
                                </div>
                                <div>
                                    <div style={{ fontWeight: isActive ? 700 : 600, color: isActive ? "var(--text)" : "var(--text-muted)" }}>{`Step ${idx + 1}：${s.label}`}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </aside>

                {/* Right: Content */}
                <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
                    {/* Header */}
                    <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-start" }}>
                        <button onClick={onBack} className="btn btn-ghost btn-sm">← 返回入口</button>
                        <div>
                            <h2 style={{ margin: 0 }}>连接生产数据库</h2>
                            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>支持 MES / PLC / 传感器 / 历史数据库</div>
                        </div>
                    </div>

                    {/* Steps indicator (inline for context) */}
                    <div className="card" style={{ padding: 24, marginBottom: 16, background: "#f7f9fc" }}>
                        <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
                            <div style={{ color: step === "connect" ? "var(--accent)" : "var(--text-muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Server size={16} /> Step 1 · 选择数据源</div>
                            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>请选择你的生产数据来源并校验连通性</div>
                        </div>
                    </div>

                    {/* Step 1: Connect */}
                    {step === "connect" && (
                        <div className="card" style={{ padding: 32, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}>
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>选择你的生产数据来源</h3>
                                <p className="text-muted" style={{ marginTop: 6 }}>支持 MES / PLC / 传感器 / 历史数据库，工业现场友好</p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                                {dataSources.map(ds => {
                                    const active = customForm.type === ds.id;
                                    return (
                                        <div key={ds.id}
                                            onClick={() => { setIsCustom(true); setCustomForm({ ...customForm, type: ds.id as any }); }}
                                            style={{
                                                border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
                                                background: active ? "rgba(47,108,255,0.06)" : "white",
                                                borderRadius: 12,
                                                padding: 14,
                                                cursor: "pointer",
                                                display: "flex",
                                                gap: 12,
                                                alignItems: "flex-start",
                                                boxShadow: active ? "0 6px 18px rgba(47,108,255,0.12)" : "0 4px 10px rgba(0,0,0,0.03)",
                                                transition: "all 0.15s ease"
                                            }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? "rgba(47,108,255,0.16)" : "#f3f5f9", display: "grid", placeItems: "center", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                                                {ds.icon}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700 }}>{ds.name}</div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{ds.desc}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="card" style={{ padding: 16, border: "1px dashed var(--border-subtle)", background: "#fafbfe", marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <label className="param-label" style={{ margin: 0, minWidth: 120 }}>选择数据库实例</label>
                                    <select className="param-input" style={{ flex: 1, height: 44 }} value={selectedConnId} onChange={e => {
                                        setIsCustom(false);
                                        setSelectedConnId(e.target.value);
                                        const saved = savedConns.find(s => s.id === e.target.value);
                                        setRenameValue(saved?.name || "");
                                    }}>
                                        <option value="">-- 请选择产线或系统 --</option>
                                        {savedConns.map(p => <option key={p.id} value={p.id}>[{p.isPreset ? "预设" : "自定义"}] {p.name} ({p.type})</option>)}
                                    </select>
                                </div>
                                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setIsCustom(true); setSelectedConnId(""); setCustomForm({ name: "", type: "mssql" as any, host: "", port: 1433, database: "", user: "", password: "" }); setRenameValue(""); }}>新增实例</button>
                                    {selectedConnId && savedConns.find(s => s.id === selectedConnId) && (
                                        <>
                                            <input
                                                className="param-input"
                                                style={{ flex: 1, minWidth: 180, height: 36 }}
                                                value={renameValue}
                                                placeholder="修改实例显示名称"
                                                onChange={e => setRenameValue(e.target.value)}
                                            />
                                            <button className="btn btn-secondary btn-sm" disabled={!renameValue || loading} onClick={handleRename}>重命名</button>
                                            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={handleDeleteConn}>删除</button>
                                        </>
                                    )}
                                </div>
                                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: connStatus === "error" ? "#d64545" : connStatus === "success" ? "#1f9d55" : "var(--text-muted)", fontSize: 13 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 4, background: connStatus === "error" ? "#d64545" : connStatus === "success" ? "#1f9d55" : "#c2c8d0" }} />
                                    <span>{statusMsg}</span>
                                    {connStatus === "error" && <span style={{ color: "#d64545" }}>请检查防火墙 / 账号 / 证书</span>}
                                </div>
                                <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>若无预设，可直接在下方填写自定义连接参数。</div>
                            </div>

                            <div className="param-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
                                <div className="param-item">
                                    <label className="param-label">连接显示名称</label>
                                    <input className="param-input" placeholder="例如：注塑机实时库" value={customForm.name} onChange={e => setCustomForm({ ...customForm, name: e.target.value })} />
                                </div>
                                <div className="param-item">
                                    <label className="param-label">数据库类型</label>
                                    <select className="param-input" value={customForm.type} onChange={e => setCustomForm({ ...customForm, type: e.target.value as any })}>
                                        <option value="mssql">SQL Server</option>
                                        <option value="postgres">PostgreSQL</option>
                                        <option value="mysql">MySQL / MariaDB</option>
                                    </select>
                                </div>
                                <div className="param-item">
                                    <label className="param-label">服务器地址 / 名称</label>
                                    <input
                                        className="param-input"
                                        placeholder="10.0.0.5 或 MES-SQLSERVER01"
                                        value={customForm.host}
                                        onChange={e => setCustomForm({ ...customForm, host: e.target.value })}
                                    />
                                </div>
                                <div className="param-item">
                                    <label className="param-label">端口</label>
                                    <input className="param-input" type="number" value={customForm.port} onChange={e => setCustomForm({ ...customForm, port: parseInt(e.target.value) })} />
                                </div>
                                <div className="param-item">
                                    <label className="param-label">库名</label>
                                    <input className="param-input" placeholder="MES_PROD" value={customForm.database} onChange={e => setCustomForm({ ...customForm, database: e.target.value })} />
                                </div>
                                <div className="param-item">
                                    <label className="param-label">账号</label>
                                    <input className="param-input" value={customForm.user} onChange={e => setCustomForm({ ...customForm, user: e.target.value })} />
                                </div>
                                <div className="param-item">
                                    <label className="param-label">密码</label>
                                    <input className="param-input" type="password" value={customForm.password} onChange={e => setCustomForm({ ...customForm, password: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
                                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>建议先测试连接，预计耗时 {"< 5 秒"}</div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button className="btn btn-secondary" disabled={loading || !canProceed} onClick={handleTest}>测试连接</button>
                                    <button className="btn btn-ghost" disabled={loading} onClick={onBack}>保存并退出</button>
                                    <button className="btn btn-primary" style={{ minWidth: 140 }} disabled={loading || !canProceed} onClick={goToSelect}>
                                        {loading ? "处理中..." : "下一步"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Table & Preview */}
                    {step === "select" && (
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 24, alignItems: "start" }}>
                            <div className="card" style={{ padding: 16, minWidth: 0 }}>
                                <h3>选择数据表</h3>
                                <div className="search-input" style={{ marginTop: 10 }}>
                                    <span className="search-icon">🔍</span>
                                    <input
                                        placeholder="搜索表名..."
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                    />
                                </div>
                                <div
                                    className="tree-list"
                                    style={{ marginTop: 16, maxHeight: 480, overflowY: "auto", overflowX: "auto", paddingRight: 6 }}
                                >
                                    {tree.map(node => (
                                        <div key={node.name}>
                                            <div style={{ fontWeight: 600, padding: "8px 0", fontSize: 13, color: "var(--text-muted)" }}>{node.name}</div>
                                            <div style={{ marginLeft: 12 }}>
                                                {node.children
                                                    ?.filter(table =>
                                                        !tableSearch || table.name.toLowerCase().includes(tableSearch.toLowerCase())
                                                    )
                                                    .map(table => (
                                                        <div key={table.name}
                                                            onClick={() => handlePreview(table.name)}
                                                            className={`nav-item ${selectedTable === table.name ? "active" : ""}`}
                                                            style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, fontSize: 14 }}>
                                                            {table.name}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card" style={{ padding: 24, overflowX: "auto", minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                                    <h3>确认数据样本</h3>
                                    <button className="btn btn-primary" disabled={!selectedTable || loading} onClick={() => setStep("range")}>
                                        确认，去取数范围控制 →
                                    </button>
                                </div>

                                {!preview ? (
                                    <div className="empty-state" style={{ padding: 60 }}>
                                        <Database size={40} className="text-muted" style={{ marginBottom: 16 }} />
                                        <p>请在左侧选择一个数据表进行预览</p>
                                    </div>
                                ) : (
                                    <div className="preview-container">
                                        <div className="data-table-wrap" style={{ maxHeight: 400, overflowX: "auto" }}>
                                            <table className="data-table" style={{ minWidth: Math.max(preview.columns.length * 140, 800) }}>
                                                <thead>
                                                    <tr>
                                                        {preview.columns.map(c => <th key={c.name}>{c.name}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.rows.map((row, i) => (
                                                        <tr key={i}>
                                                            {preview.columns.map(c => <td key={c.name}>{String(row[c.name] ?? "")}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
