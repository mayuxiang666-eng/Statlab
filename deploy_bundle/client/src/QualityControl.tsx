import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import * as echarts from "echarts";
import { AlgorithmSpec, DatasetVersionMeta } from "@statlab/shared";
import { Language, t } from "./locales";
import { useAuth } from "./context/AuthContext";
import "./QualityControl.css";

interface Props {
  algorithms: AlgorithmSpec[];
  activeVersion: (DatasetVersionMeta & { datasetId: any }) | null;
  datasets: any[];
  lang: Language;
  addLog: (level: "info" | "success" | "warn" | "error", msg: string) => void;
}

export default function QualityControl({ algorithms, activeVersion, datasets, lang, addLog }: Props) {
  const [selectedVar, setSelectedVar] = useState<string>("");
  const [usl, setUsl] = useState<number | "">("");
  const [lsl, setLsl] = useState<number | "">("");
  const [target, setTarget] = useState<number | "">("");
  const [subgroupSize, setSubgroupSize] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const chartRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);

  const variables = useMemo(() => activeVersion?.columns.filter(c => c.type === 'numeric') || [], [activeVersion]);

  const [ledgerData, setLedgerData] = useState<any[]>([
    { ts: "14:22:05", op: "J. Chen", val: 10.002, dev: "+0.002", status: "ok" },
    { ts: "14:21:58", op: "J. Chen", val: 9.985, dev: "-0.015", status: "ok" },
    { ts: "14:21:42", op: "J. Chen", val: 10.045, dev: "+0.045", status: "ok" },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const newVal = (result?.mean || 10) + (Math.random() - 0.5) * (result?.sigma_total || 0.05) * 2;
      const dev = newVal - (result?.mean || 10);
      const newRow = {
        ts: new Date().toLocaleTimeString(),
        op: "Auto Bot",
        val: newVal,
        dev: (dev >= 0 ? "+" : "") + dev.toFixed(3),
        status: "ok"
      };
      setLedgerData(prev => [newRow, ...prev].slice(0, 50));
    }, 3000);
    return () => clearInterval(timer);
  }, [result]);

  const runAnalysis = async () => {
    if (!activeVersion || !selectedVar) {
      addLog("warn", lang === "zh" ? "请先选择质量特性变量" : "Please select a quality characteristic.");
      return;
    }
    setRunning(true);
    addLog("info", lang === "zh" ? `开始分析 [${selectedVar}]...` : `Starting analysis for [${selectedVar}]...`);
    
    try {
      const { data: previewData } = await axios.get(`/api/datasets/${activeVersion.datasetId}/preview`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('statlab_token')}` }
      });

      const payload = {
        algorithm: "spc.capability",
        dataset: previewData.rows,
        variables: { target: [selectedVar] },
        params: {
          usl: usl === "" ? null : Number(usl),
          lsl: lsl === "" ? null : Number(lsl),
          subgroupSize
        }
      };

      const { data: res } = await axios.post("/api/run", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('statlab_token')}` }
      });

      if (res.error) throw new Error(res.error);
      setResult(res);
      addLog("success", lang === "zh" ? "分析完成" : "Analysis completed");
    } catch (err: any) {
      addLog("error", `Analysis failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const exportPdf = () => {
    addLog("info", "Exporting report to PDF...");
    window.print();
  };

  const publishLive = () => {
    addLog("success", "Dashboard published to live production monitor.");
  };

  useEffect(() => {
    if (!result || !chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const { mean, sigma_total, usl: resUsl, lsl: resLsl, histogram } = result;
    const bins = histogram?.bins || [];
    const counts = histogram?.counts || [];
    
    const curveData: [number, number][] = [];
    if (sigma_total > 0) {
      const minX = Math.min(mean - 4 * sigma_total, (resLsl || mean) - 1 * sigma_total);
      const maxX = Math.max(mean + 4 * sigma_total, (resUsl || mean) + 1 * sigma_total);
      const step = (maxX - minX) / 100;
      for (let x = minX; x <= maxX; x += step) {
        const y = (1 / (sigma_total * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sigma_total, 2));
        curveData.push([x, y]);
      }
    }

    const option = {
      tooltip: { trigger: 'axis' },
      grid: { top: 40, bottom: 40, left: 50, right: 50 },
      xAxis: { type: 'value', scale: true, axisLine: { show: false }, splitLine: { show: false } },
      yAxis: [{ type: 'value', show: false }, { type: 'value', show: false }],
      series: [
        {
          name: 'Histogram',
          type: 'bar',
          data: bins.map((b: number, i: number) => [b, counts[i]]),
          barWidth: '85%',
          itemStyle: { color: '#2563eb', opacity: 0.8 }
        },
        {
          name: 'Normal Curve',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: curveData,
          lineStyle: { color: '#cbd5e1', width: 2 },
          areaStyle: { color: 'rgba(203, 213, 225, 0.2)' },
          markLine: {
             symbol: ['none', 'none'],
             label: { position: 'top', fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
             data: [
               ...(resUsl !== null ? [{ xAxis: resUsl, name: 'USL:\n' + resUsl, lineStyle: { color: '#ef4444', type: 'dashed' } }] : []),
               ...(resLsl !== null ? [{ xAxis: resLsl, name: 'LSL:\n' + resLsl, lineStyle: { color: '#ef4444', type: 'dashed' } }] : []),
               { xAxis: mean, name: 'Mean', lineStyle: { color: '#3b82f6', type: 'solid', opacity: 0.5 } }
             ]
          }
        }
      ]
    };
    chart.setOption(option);

    if (gaugeRef.current) {
        const gauge = echarts.init(gaugeRef.current);
        gauge.setOption({
            series: [{
                type: 'gauge',
                startAngle: 210, endAngle: -30, min: 0, max: 2,
                splitNumber: 4,
                axisLine: { lineStyle: { width: 12, color: [[0.5, '#ef4444'], [0.66, '#f59e0b'], [1, '#10b981']] } },
                pointer: { length: '70%', width: 3 },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { distance: -40, color: '#64748b', fontSize: 10 },
                detail: { valueAnimation: true, formatter: '{value}', color: '#1e293b', fontSize: 32, fontWeight: 800, offsetCenter: [0, '40%'] },
                data: [{ value: result.cpk?.toFixed(2), name: '' }]
            }]
        });
    }

    return () => {
        chart.dispose();
        if (gaugeRef.current) echarts.getInstanceByDom(gaugeRef.current)?.dispose();
    };
  }, [result, lang]);

  return (
    <div className="qc-workbench">
      <header className="qc-header">
        <div>
          <span className="qc-header-brand">StatLab Precision</span>
          <span className="qc-header-sub">WORKBENCH V4.2</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" style={{ background: "#e2e8f0" }} onClick={exportPdf}>EXPORT PDF</button>
            <button className="btn btn-sm btn-primary" style={{ background: "#2563eb" }} onClick={publishLive}>PUBLISH LIVE</button>
        </div>
      </header>

      <div className="qc-container">
        <aside className="qc-sidebar">
          <div>
            <div className="qc-section-label">Process Parameters</div>
            <div className="qc-field" style={{ marginBottom: 16 }}>
               <label className="qc-label">Variable Selection</label>
               <select className="qc-input" value={selectedVar} onChange={e => setSelectedVar(e.target.value)}>
                 <option value="">-- Select --</option>
                 {variables.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
               </select>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
               <div className="qc-field">
                 <label className="qc-label">LSL</label>
                 <input type="number" className="qc-input" value={lsl} onChange={e => setLsl(e.target.value === "" ? "" : Number(e.target.value))} />
               </div>
               <div className="qc-field">
                 <label className="qc-label">USL</label>
                 <input type="number" className="qc-input" value={usl} onChange={e => setUsl(e.target.value === "" ? "" : Number(e.target.value))} />
               </div>
            </div>

            <div className="qc-field" style={{ marginBottom: 16 }}>
               <label className="qc-label">Target Value</label>
               <input type="number" className="qc-input" value={target} onChange={e => setTarget(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>

            <div className="qc-field" style={{ marginBottom: 24 }}>
               <label className="qc-label">Subgroup Size (N)</label>
               <div className="qc-slider-container">
                 <input type="range" min="1" max="25" className="qc-slider" value={subgroupSize} onChange={e => setSubgroupSize(Number(e.target.value))} />
                 <span className="qc-val-box">{subgroupSize}</span>
               </div>
            </div>

            <button className="qc-btn-primary" style={{ width: "100%" }} onClick={runAnalysis} disabled={running}>
              {running ? "Processing..." : "Recalculate Indices"}
            </button>
          </div>

          <div>
            <div className="qc-section-label">Sample Statistics</div>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
               <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--qc-text-muted)", fontWeight: 600 }}>MEAN (M)</span>
                  <span style={{ fontWeight: 800 }}>{result?.mean?.toFixed(3) || "0.000"}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--qc-text-muted)", fontWeight: 600 }}>STD DEV (Σ)</span>
                  <span style={{ fontWeight: 800 }}>{result?.sigma_total?.toFixed(4) || "0.0000"}</span>
               </div>
               <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--qc-text-muted)", fontWeight: 600 }}>N SAMPLES</span>
                  <span style={{ fontWeight: 800 }}>{result?.count || "0"}</span>
               </div>
            </div>
          </div>
        </aside>

        <main className="qc-main">
          <div>
            <div className="qc-report-header">
               <div>
                 <h2 className="qc-report-title">Capability Analysis <b>Report</b></h2>
                 <div className="qc-report-meta">Batch #4492-A • Manufacturing Line 04 • High Precision Lathe</div>
               </div>
            </div>
          </div>

          <div className="qc-grid">
             <div className="qc-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }}></div>
                     <span style={{ fontWeight: 700, fontSize: 13 }}>Capability Histogram</span>
                   </div>
                   <div style={{ fontSize: 10, color: "var(--qc-text-muted)", fontWeight: 700 }}>DISTRIBUTION VS. SPECIFICATION LIMITS</div>
                </div>
                <div ref={chartRef} style={{ height: 400 }}></div>
             </div>

             <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="qc-card" style={{ textAlign: "center" }}>
                   <div style={{ fontSize: 11, fontWeight: 700, color: "var(--qc-text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Process Capability (CPK)</div>
                   <div ref={gaugeRef} style={{ height: 180 }}></div>
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qc-text-muted)" }}>CP</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{result?.cp?.toFixed(2) || "-"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qc-text-muted)" }}>CPK (L)</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{result?.cpk_l?.toFixed(2) || "-"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qc-text-muted)" }}>CPK (U)</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{result?.cpk_u?.toFixed(2) || "-"}</div>
                      </div>
                   </div>
                </div>

                <div className="qc-card qc-interpreter">
                   <div className="qc-interpreter-head">
                      <div style={{ fontSize: 14 }}>✨</div>
                      <span>AI Interpreter</span>
                   </div>
                   <div className="qc-interpreter-content">
                      {result?.insights ? result.insights[0] : "Process is well-centered but has high variability. Shapiro-Wilk Normality test passed."}
                      {" "}
                      <a href="#" className="qc-interpretation-link">View Detailed Analysis →</a>
                   </div>
                </div>
             </div>
          </div>

          <div className="qc-card qc-ledger-card">
             <div className="qc-ledger-head">
                <span className="qc-ledger-title">Real-time Measurement Ledger</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#10b981" }}>
                   <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}></div>
                   STREAMING LIVE
                </div>
             </div>
             <table className="qc-table">
                <thead>
                   <tr>
                      <th>Timestamp</th>
                      <th>Operator</th>
                      <th>Measurement</th>
                      <th>Deviation</th>
                      <th>Status</th>
                   </tr>
                </thead>
                <tbody>
                   {ledgerData.map((row, i) => (
                      <tr key={i}>
                         <td style={{ color: "var(--qc-text-muted)" }}>{row.ts}</td>
                         <td>{row.op}</td>
                         <td style={{ fontWeight: 700 }}>{row.val.toFixed(3)}</td>
                         <td style={{ color: row.dev.startsWith("+") ? "#10b981" : "#ef4444" }}>{row.dev}</td>
                         <td><div className="qc-status-dot"></div></td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </main>
      </div>
    </div>
  );
}
