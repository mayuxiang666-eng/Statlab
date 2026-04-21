import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import * as echarts from "echarts";

interface Props {
  datasets: any[];
  activeDataset: any;
  activeVersion: any;
  activeDatasetId: any;
  setActiveDatasetId: (id: any) => void;
  setActiveVersion: (v: any) => void;
  addLog: (level: "info" | "success" | "warn" | "error", msg: string) => void;
  setShowUploadModal: (b: boolean) => void;
  setPage: (p: any) => void;
  importSample: (name?: string) => void;
}

const PAGE_SIZE = 10;

export default function DataPage({
  datasets,
  activeDataset,
  activeVersion,
  activeDatasetId,
  setActiveDatasetId,
  setActiveVersion,
  addLog,
  setShowUploadModal,
  setPage,
  importSample,
}: Props) {
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("TIMESTAMP");
  const [operatorFilter, setOperatorFilter] = useState("ALL");
  const [matrixCols, setMatrixCols] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isMatrixExpanded, setIsMatrixExpanded] = useState(false);
  const matrixRef = useRef<HTMLDivElement>(null);
  const expandedMatrixRef = useRef<HTMLDivElement>(null);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("statlab_token")}`,
  });

  const numericCols = useMemo(
    () => activeVersion?.columns.filter((c: any) => c.type === "numeric").map((c: any) => c.name) || [],
    [activeVersion]
  );

  // Derive column names from ACTUAL row keys (most reliable — matches whatever the API returns)
  // Fall back to activeVersion.columns only if rows aren't loaded yet
  const colNames = useMemo(() => {
    if (previewRows.length > 0) {
      return Object.keys(previewRows[0]).filter(k => k !== '__rowNum__' && k !== '_id');
    }
    return activeVersion?.columns.map((c: any) => c.name) || [];
  }, [previewRows, activeVersion]);

  useEffect(() => {
    if (!activeVersion) return;
    setLoading(true);
    const dsId = activeVersion.datasetId ?? activeDatasetId;
    axios
      .get(`/api/datasets/${dsId}/preview`, {
        headers: getAuthHeader(),
      })
      .then((r) => {
        const raw = r.data;
        const rows = Array.isArray(raw) ? raw : (raw.rows ?? raw.data ?? []);
        setPreviewRows(rows);
        setCurrentPage(1);
      })
      .catch(() => setPreviewRows([]))
      .finally(() => setLoading(false));
  }, [activeVersion]);

  // Sync sortField when actual columns arrive
  useEffect(() => {
    if (colNames.length > 0 && !colNames.includes(sortField)) {
      setSortField(colNames[0]);
    }
  }, [colNames]);
  const sortedRows = useMemo(() => {
    return [...previewRows].sort((a, b) => {
      const va = a[sortField] ?? "";
      const vb = b[sortField] ?? "";
      if (typeof va === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
  }, [previewRows, sortField]);

  const paginatedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);  const [fullStats, setFullStats] = useState<any>(null);
  const [statsLoadingProgress, setStatsLoadingProgress] = useState(false);

  useEffect(() => {
    if (!activeVersion) return;
    setStatsLoadingProgress(true);
    axios.get(`/api/stats/${activeVersion.id}`, { headers: getAuthHeader() })
      .then(r => setFullStats(r.data))
      .catch(() => setFullStats(null))
      .finally(() => setStatsLoadingProgress(false));
  }, [activeVersion]);

  // Outlier detection using fullStats if available
  const getOutlierCount = (col: string) => {
    if (!fullStats || !fullStats[col] || fullStats[col].type !== 'numeric') return 0;
    const { mean, std } = fullStats[col];
    return previewRows.filter(r => Math.abs(Number(r[col]) - mean) > 3 * std).length;
  };

  const healthScore = useMemo(() => {
    if (!activeVersion || previewRows.length === 0) return 0;
    const avgMissing = activeVersion.columns.reduce((a: number, b: any) => a + (b.missingRate || 0), 0) / (activeVersion.columns.length || 1);
    
    let outlierRate = 0;
    if (fullStats) {
      const numericCols = Object.keys(fullStats).filter(k => fullStats[k].type === 'numeric');
      if (numericCols.length > 0) {
        const rates = numericCols.map(c => getOutlierCount(c) / previewRows.length);
        outlierRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }
    
    const score = (1 - avgMissing) * 40 + (1 - outlierRate) * 40 + 20;
    return Math.min(100, Math.max(0, Math.round(score)));
  }, [activeVersion, previewRows, fullStats]);

  // Build correlation matrix chart
  const _generateMatrix = useCallback((isExpanded: boolean) => {
    if (matrixCols.length < 2) return;
    const targetRef = isExpanded ? expandedMatrixRef.current : matrixRef.current;
    if (!targetRef) return;

    setStatsLoading(true);
    // Use a small timeout to ensure DOM is ready and avoid blocking UI
    setTimeout(() => {
      const data = matrixCols.map((rowCol) =>
        matrixCols.map((colCol) => {
          if (rowCol === colCol) return 1;
          const pairs: {x: number, y: number}[] = [];
          for (const r of previewRows) {
            const vx = r[rowCol];
            const vy = r[colCol];
            if (vx !== "" && vy !== "" && vx !== null && vy !== null && vx !== undefined && vy !== undefined) {
              const x = Number(vx);
              const y = Number(vy);
              if (!isNaN(x) && !isNaN(y)) {
                pairs.push({x, y});
              }
            }
          }
          const n = pairs.length;
          if (n === 0) return 0;
          const mx = pairs.reduce((acc, p) => acc + p.x, 0) / n;
          const my = pairs.reduce((acc, p) => acc + p.y, 0) / n;
          const cov = pairs.reduce((acc, p) => acc + (p.x - mx) * (p.y - my), 0) / n;
          const varX = pairs.reduce((acc, p) => acc + Math.pow(p.x - mx, 2), 0) / n;
          const varY = pairs.reduce((acc, p) => acc + Math.pow(p.y - my, 2), 0) / n;
          const sdx = Math.sqrt(varX);
          const sdy = Math.sqrt(varY);
          if (sdx === 0 || sdy === 0) return 0;
          return parseFloat((cov / (sdx * sdy)).toFixed(3));
        })
      );

      const chart = echarts.getInstanceByDom(targetRef) || echarts.init(targetRef);
      chart.setOption({
        grid: { top: 40, left: 80, right: 40, bottom: 80 },
        xAxis: { type: "category", data: matrixCols, axisLabel: { rotate: 30, fontSize: isExpanded ? 12 : 10 } },
        yAxis: { type: "category", data: matrixCols, axisLabel: { fontSize: isExpanded ? 12 : 10 } },
        visualMap: { min: -1, max: 1, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#ef4444", "#f8fafc", "#2563eb"] }, textStyle: { fontSize: 10 } },
        series: [{ type: "heatmap", data: matrixCols.flatMap((r, ri) => matrixCols.map((c, ci) => [ci, ri, data[ri][ci]])), label: { show: true, fontSize: isExpanded ? 11 : 9 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } } }],
      });
      setStatsLoading(false);
    }, 50);
  }, [matrixCols, previewRows]);

  const generateMatrix = useCallback(() => _generateMatrix(false), [_generateMatrix]);
  const generateExpandedMatrix = useCallback(() => _generateMatrix(true), [_generateMatrix]);

  useEffect(() => {
    if (matrixCols.length >= 2) generateMatrix();
  }, [matrixCols, generateMatrix]);

  useEffect(() => {
    if (isMatrixExpanded && matrixCols.length >= 2) {
      setTimeout(generateExpandedMatrix, 100);
    }
  }, [isMatrixExpanded, matrixCols, generateExpandedMatrix]);

  if (!activeDataset) {
    return (
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 32, background: "#f8fafc", minHeight: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <h2 style={{ fontWeight: 800, fontSize: 24, margin: 0 }}>欢迎来到数据中心</h2>
          <p style={{ color: "#64748b", marginTop: 8 }}>管理您的业务数据，进行清洗、统计分析或机器学习建模。</p>
          <button onClick={() => setShowUploadModal(true)} style={{ marginTop: 20, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "12px 32px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            + 开始上传数据集
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, width: "100%", maxWidth: 720 }}>
          {[
            { icon: "🔬", title: "基础科学示例", desc: "通用统计分析演示", action: () => importSample() },
            { icon: "📈", title: "销售回测模型", desc: "广告投放与ROI分析", action: () => importSample("advertising") },
            { icon: "🛠️", title: "数据处理", desc: "缺失/异常/编码", action: () => setPage("process") },
            { icon: "🔌", title: "外部取数", desc: "MES/PLC 数据库直连", action: () => setPage("db-connect") },
          ].map((c, i) => (
            <div key={i} onClick={c.action} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20, cursor: "pointer", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9", fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "#e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        {[
          { label: "变量总数", val: activeVersion?.columns?.length || 0, unit: "" },
          { label: "样本总量", val: (activeVersion?.rowCount ?? previewRows.length).toLocaleString(), unit: "" },
          { label: "行数", val: (activeVersion?.rowCount ?? previewRows.length).toLocaleString(), unit: "" },
          { label: "缺失率", val: ((activeVersion?.columns.reduce((a: number, b: any) => a + b.missingRate, 0) / (activeVersion?.columns.length || 1)) * 100).toFixed(2), unit: "%" },
          { 
            label: "数据健康度", 
            val: healthScore, 
            unit: "%",
            color: healthScore > 80 ? "#22c55e" : healthScore > 50 ? "#f59e0b" : "#ef4444"
          },
        ].map((s: any, i) => (
          <div key={i} style={{ background: "#fff", padding: "20px 28px", display: "flex", alignItems: "baseline", gap: 8, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: i === 4 ? `linear-gradient(90deg, ${s.color}15 30%, transparent)` : "linear-gradient(90deg, #f0f6ff 30%, transparent)", opacity: 0.4 }}></div>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, color: i === 4 ? s.color : "#0f172a" }}>{s.val}</span>
            <span style={{ fontSize: 13, color: "#64748b" }}>{s.unit}</span>
            <span style={{ position: "absolute", top: 14, right: 20, fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: 24, gap: 24 }}>
        {/* Dataset Table Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: "pointer" }}
                value={sortField} onChange={e => setSortField(e.target.value)}>
                {colNames.map(c => <option key={c} value={c}>SORT: {(c || '').toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                PAGE {currentPage} / {totalPages || 1} ({Math.min(sortedRows.length, 100)} TOTAL PREVIEW ROWS)
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1 }}
                >PREV</button>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1 }}
                >NEXT</button>
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
             <div style={{ overflowX: "auto" }}>
               <table style={{ width: "100%", borderCollapse: "collapse" }}>
                 <thead>
                   <tr>
                     {colNames.slice(0, 10).map(c => (
                       <th key={c} style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "left", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", whiteSpace: "nowrap" }}>{c}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {paginatedRows.map((row, i) => (
                     <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                       {colNames.slice(0, 10).map(c => (
                         <td key={c} style={{ padding: "10px 20px", fontSize: 12, color: "#0f172a" }}>
                           {typeof row[c] === "number" ? row[c].toFixed(3) : String(row[c] ?? "")}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>

        {/* Dataset Summary Table Section */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Dataset Summary Overview</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Comprehensive statistical distribution across all columns.</p>
            </div>
            {statsLoadingProgress && <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>CALCULATING...</div>}
          </div>
          
          <div style={{ overflowX: "auto", border: "1px solid #f1f5f9", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["Column", "Type", "Count", "Missing", "Unique", "Mean", "Min", "25%", "50%", "75%", "Max", "Std"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fullStats ? Object.keys(fullStats).filter(k => k !== 'rowCount').map(col => {
                  const s = fullStats[col];
                  const isNum = s.type === 'numeric';
                  return (
                    <tr key={col} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{col}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, background: isNum ? "#eff6ff" : "#f1f5f9", color: isNum ? "#2563eb" : "#64748b", fontSize: 10, fontWeight: 700 }}>
                          {(s?.type || 'unknown').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{s.count}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: s.nullCount > 0 ? "#ef4444" : "#10b981" }}>{s.nullCount}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{s.uniqueCount}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600 }}>{isNum ? s.mean.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{isNum ? s.min.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{isNum ? s.q1.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "#2563eb" }}>{isNum ? s.q2.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{isNum ? s.q3.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{isNum ? s.max.toFixed(2) : "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>{isNum ? s.std.toFixed(3) : "—"}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Loading statistics...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Correlation Section */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Feature Correlation Heatmap</span>
            <button onClick={() => setIsMatrixExpanded(true)} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>EXPAND MATRIX</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {numericCols.map((c: string) => (
              <button key={c} onClick={() => setMatrixCols(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 600, cursor: "pointer", background: matrixCols.includes(c) ? "#2563eb" : "#fff", color: matrixCols.includes(c) ? "#fff" : "#374151" }}
              >{c}</button>
            ))}
          </div>
          {matrixCols.length < 2 ? (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 8 }}>
              Select at least 2 columns to generate correlation matrix
            </div>
          ) : (
            <div ref={matrixRef} style={{ height: 400 }}></div>
          )}
        </div>
      </div>

      {/* Expand Modal */}
      {isMatrixExpanded && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ background: "#fff", width: "90%", height: "90%", borderRadius: 12, display: "flex", flexDirection: "column", padding: 24, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Correlated Stream Matrix (High Precision)</h3>
              <button onClick={() => setIsMatrixExpanded(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div ref={expandedMatrixRef} style={{ flex: 1 }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
